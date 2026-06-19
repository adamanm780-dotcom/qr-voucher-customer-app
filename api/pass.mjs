// Vercel Serverless: erzeugt einen signierten .pkpass dynamisch.
// Aufruf:
//   /api/pass?campaign=<uuid>        -> Gutschein/Stempelkarte aus DB
//   /api/pass?enroll=<token>         -> Stempelkarten-Onboarding (neuer pass, 0 Stempel)
//   /api/pass?demo=coupon|stamp5|stamp10  -> ohne DB (Test)
import { PKPass } from 'passkit-generator';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { themeFor, assetKey, loadAssets, campaignDir } from '../lib/theme.mjs';
import { campaignMintAllowed } from '../lib/security.mjs';
import { initialRemaining } from '../lib/cards.mjs';
import { cardView } from '../lib/passview.mjs';

// ISO-Datum -> "DD.MM.YYYY" (für Gültig-bis auf dem Pass). Leer bei ungültig.
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PASS_TYPE_ID = 'pass.com.lila.gutschein';
const TEAM_ID = '4X4Z2XA87V';
const LILA = 'rgb(184, 165, 220)';

function certs() {
  return {
    signerCert: Buffer.from(process.env.APPLE_PASS_CERT_B64, 'base64'),
    signerKey: Buffer.from(process.env.APPLE_PASS_KEY_B64, 'base64'),
    wwdr: Buffer.from(process.env.APPLE_WWDR_B64, 'base64'),
  };
}
function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
}
// Karten-Code-Präfix aus dem Betrieb (NINI-…, TRAU-…, LILA-… für Lila). Fallback FS.
function serialPrefix(slug) {
  return (slug || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FS';
}
function newSerial(slug) {
  return serialPrefix(slug) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function buildPass({ key, serial, type, data }) {
  // Layout + Strip kommen aus der gemeinsamen Quelle (lib/passview.mjs) — gleiche Logik wie v1.mjs.
  const campLike = { type, config: data.config || {}, stamp_goal: data.stampGoal, reward: data.reward, value: data.value, title: data.title };
  const passLike = { stamps: data.stamps, remaining: data.remaining };
  const view = cardView(campLike, passLike, { isDefault: data.isDefault }, { startMs: data.startMs || null, nowMs: Date.now() });
  const passJson = {
    formatVersion: 1, passTypeIdentifier: PASS_TYPE_ID, teamIdentifier: TEAM_ID,
    organizationName: data.org || data.business || 'Lila Wiesbaden', description: data.title || 'lila.',
    // Markenname oben auf dem Pass (nur Nicht-Lila; Lila hat seinen Namen im Design).
    ...((data.isDefault || data.custom) && data.org ? { logoText: data.org } : {}),
    serialNumber: serial,
    foregroundColor: data.fg || 'rgb(61,42,115)', labelColor: data.label || 'rgb(90,65,140)', backgroundColor: data.bg || LILA,
    [view.style]: view.structure,
    barcodes: [{ format: 'PKBarcodeFormatQR', message: serial, messageEncoding: 'iso-8859-1', altText: serial }],
    // Web-Service: erlaubt Apple, Updates zu holen (Live-Stempel). Nur wenn authToken vorhanden.
    ...(data.authToken ? {
      webServiceURL: 'https://qr-voucher-customer-app.vercel.app/api/v1',
      authenticationToken: data.authToken,
    } : {}),
  };
  const pass = new PKPass(
    { 'pass.json': Buffer.from(JSON.stringify(passJson)), ...loadAssets(key, view.stripName) },
    certs()
  );
  return pass.getAsBuffer();
}

// data-Felder + initialer Restzähler für eine aus DB gemintete Karte (enroll + campaign teilen das).
function mintFor(camp, theme, authToken) {
  const type = camp.type;
  const config = camp.config || {};
  const remaining = initialRemaining(type, config);
  let validUntil = config.valid_until ? fmtDate(config.valid_until) : null;
  if (type === 'coupon' && !validUntil) validUntil = '31.12.2026';   // Bestandsverhalten beibehalten
  const data = {
    title: camp.title, authToken, ...theme,
    stampGoal: camp.stamp_goal, stamps: 0,
    reward: camp.reward, value: camp.value,
    remaining, config, validUntil,
    startMs: null,   // Zeit-Pass: bei Ausgabe noch NICHT gestartet -> leere Karte (0 Kreuze)
  };
  return { remaining, data };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const demo = url.searchParams.get('demo');
    const campaign = url.searchParams.get('campaign');
    const enroll = url.searchParams.get('enroll');

    let key, serial, type, data;

    if (demo) {
      type = demo.startsWith('stamp') ? 'stampcard' : 'coupon';
      const goal = demo === 'stamp10' ? 10 : 5;
      key = assetKey(type, goal);
      serial = newSerial('');
      data = type === 'stampcard'
        ? { stampGoal: goal, stamps: 0, reward: 'Dein Lieblingsdrink', title: 'lila. Stempelkarte' }
        : { value: '20%', validUntil: '31.12.2026', title: 'lila. Gutschein' };
    } else if (enroll) {
      const db = supa();
      const { data: camp, error } = await db.from('campaigns').select('*').eq('enroll_token', enroll).single();
      if (error || !camp) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
      // Missbrauchsschutz: zu viele Karten in kurzer Zeit für diese Kampagne -> stoppen.
      if (!(await campaignMintAllowed(db, camp.id))) {
        res.setHeader('Retry-After', '600');
        return res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
      }
      const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text').eq('id', camp.business_id).maybeSingle();
      const theme = themeFor(biz);
      type = camp.type;
      key = campaignDir(biz?.slug, camp.id) || assetKey(type, camp.stamp_goal, theme.prefix);
      serial = newSerial(biz?.slug);
      const authToken = crypto.randomBytes(16).toString('hex');
      const minted = mintFor(camp, theme, authToken);
      // neuen pass-Datensatz anlegen
      await db.from('passes').insert({
        campaign_id: camp.id, business_id: camp.business_id, serial,
        auth_token: authToken, stamps: 0, status: 'active',
        ...(minted.remaining != null ? { remaining: minted.remaining } : {}),
      });
      data = minted.data;
    } else if (campaign) {
      const db = supa();
      const { data: camp, error } = await db.from('campaigns').select('*').eq('id', campaign).single();
      if (error || !camp) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
      // Missbrauchsschutz: zu viele Karten/Gutscheine in kurzer Zeit -> stoppen.
      if (!(await campaignMintAllowed(db, camp.id))) {
        res.setHeader('Retry-After', '600');
        return res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
      }
      const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text').eq('id', camp.business_id).maybeSingle();
      const theme = themeFor(biz);
      type = camp.type;
      key = campaignDir(biz?.slug, camp.id) || assetKey(type, camp.stamp_goal, theme.prefix);
      serial = newSerial(biz?.slug);
      const authToken = crypto.randomBytes(16).toString('hex');
      const minted = mintFor(camp, theme, authToken);
      await db.from('passes').insert({
        campaign_id: camp.id, business_id: camp.business_id, serial,
        auth_token: authToken, stamps: 0, status: 'active',
        ...(minted.remaining != null ? { remaining: minted.remaining } : {}),
      });
      data = minted.data;
    } else {
      return res.status(400).json({ error: 'Parameter fehlt: demo, campaign oder enroll' });
    }

    const buf = buildPass({ key, serial, type, data });
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('pass error:', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Pass-Erstellung fehlgeschlagen' });
  }
}

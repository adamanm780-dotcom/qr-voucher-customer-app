// Vercel Serverless: erzeugt einen signierten .pkpass dynamisch.
// Aufruf:
//   /api/pass?campaign=<uuid>        -> Gutschein/Stempelkarte aus DB
//   /api/pass?enroll=<token>         -> Stempelkarten-Onboarding (neuer pass, 0 Stempel)
//   /api/pass?demo=coupon|stamp5|stamp10  -> ohne DB (Test)
import { PKPass } from 'passkit-generator';
import { createClient } from '@supabase/supabase-js';
import { assetKey, loadAssets } from '../lib/theme.mjs';
import { cardView } from '../lib/passview.mjs';
import { mintCard, newSerial } from '../lib/mint.mjs';

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
    } else if (enroll || campaign) {
      const db = supa();
      const m = await mintCard(db, { campaign, enroll });
      if (!m.ok) {
        if (m.status === 429) res.setHeader('Retry-After', '600');
        return res.status(m.status).json({ error: m.error });
      }
      key = m.key; serial = m.serial; type = m.type; data = m.data;
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

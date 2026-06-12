// Apple PassKit Web Service Protocol — alle Endpoints in einer Funktion.
// Apple ruft diese URLs auf, sobald ein Pass mit webServiceURL in einer Wallet liegt.
//
// 1. Registrieren:   POST   /v1/devices/{deviceLibId}/registrations/{passTypeId}/{serial}   (Body: {pushToken})
// 2. Abmelden:       DELETE /v1/devices/{deviceLibId}/registrations/{passTypeId}/{serial}
// 3. Serials holen:  GET    /v1/devices/{deviceLibId}/registrations/{passTypeId}?passesUpdatedSince=...
// 4. Pass holen:     GET    /v1/passes/{passTypeId}/{serial}    (Header: Authorization: ApplePass <authToken>)
// 5. Log:            POST   /v1/log
import { createClient } from '@supabase/supabase-js';
import { PKPass } from 'passkit-generator';
import { themeFor, assetKey, loadAssets } from '../lib/theme.mjs';

const PASS_TYPE_ID = 'pass.com.lila.gutschein';
const TEAM_ID = '4X4Z2XA87V';

const supa = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const certs = () => ({
  signerCert: Buffer.from(process.env.APPLE_PASS_CERT_B64, 'base64'),
  signerKey: Buffer.from(process.env.APPLE_PASS_KEY_B64, 'base64'),
  wwdr: Buffer.from(process.env.APPLE_WWDR_B64, 'base64'),
});

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>{try{resolve(JSON.parse(d||'{}'))}catch{resolve({})}}); });
}

// Pass für eine serial aus DB neu bauen (aktueller Stempelstand)
async function buildPassForSerial(db, serial) {
  const { data: pass } = await db.from('passes').select('*').eq('serial', serial).single();
  if (!pass) return null;
  const { data: camp } = await db.from('campaigns').select('*').eq('id', pass.campaign_id).single();
  if (!camp) return null;
  const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text').eq('id', pass.business_id).maybeSingle();
  const theme = themeFor(biz);
  const isStamp = camp.type === 'stampcard';
  const goal = camp.stamp_goal || 10;
  const structure = isStamp
    ? { headerFields: [{ key:'count', label:'STEMPEL', value:`${pass.stamps||0}/${goal}` }],
        secondaryFields: [{ key:'reward', label:'BELOHNUNG', value: camp.reward || 'Dein Lieblingsdrink' }] }
    : { primaryFields: [], secondaryFields: [
        ...(theme.isDefault && camp.value ? [{ key:'value', label:'WERT', value: camp.value }] : []),
        { key:'valid', label:'GÜLTIG BIS', value:'31.12.2026' }] };
  const passJson = {
    formatVersion:1, passTypeIdentifier:PASS_TYPE_ID, teamIdentifier:TEAM_ID,
    organizationName: theme.org, description: camp.title || theme.org,
    ...((theme.isDefault || theme.custom) && theme.org ? { logoText: theme.org } : {}),
    serialNumber: serial, foregroundColor: theme.fg, labelColor: theme.label, backgroundColor: theme.bg,
    [isStamp?'storeCard':'coupon']: structure,
    barcodes:[{ format:'PKBarcodeFormatQR', message:serial, messageEncoding:'iso-8859-1', altText:serial }],
    webServiceURL:'https://qr-voucher-customer-app.vercel.app/api/v1',
    authenticationToken: pass.auth_token,
  };
  // Stempelkarte: Strip zum aktuellen Stand (strip_<voll>); Gutschein: Standard-Strip.
  const filled = Math.max(0, Math.min(pass.stamps || 0, goal));
  const stripName = isStamp ? `strip_${filled}` : 'strip';
  const pkpass = new PKPass({ 'pass.json': Buffer.from(JSON.stringify(passJson)), ...loadAssets(assetKey(camp.type, goal, theme.prefix), stripName) }, certs());
  return { buf: pkpass.getAsBuffer(), updatedAt: pass.updated_at };
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    // Pfad nach /api/v1 zerlegen
    const path = url.pathname.replace(/^\/api\/v1/, '').replace(/^\/v1/, '');
    const parts = path.split('/').filter(Boolean);
    const db = supa();

    // POST /log
    if (parts[0] === 'log') {
      try { const b = await readBody(req); console.log('PassKit log:', JSON.stringify(b).slice(0, 500)); } catch {}
      return res.status(200).end();
    }

    // /devices/{deviceLibId}/registrations/{passTypeId}[/{serial}]
    if (parts[0] === 'devices' && parts[2] === 'registrations') {
      const deviceLibId = parts[1];
      const passTypeId = parts[3];
      const serial = parts[4];

      // REGISTER: POST .../{serial}  Body {pushToken}
      if (req.method === 'POST' && serial) {
        const body = await readBody(req);
        const pushToken = body.pushToken;
        // Auth prüfen
        const auth = (req.headers['authorization'] || '').replace('ApplePass ', '');
        const { data: pass } = await db.from('passes').select('auth_token').eq('serial', serial).single();
        if (!pass || pass.auth_token !== auth) return res.status(401).end();
        const { data: existing } = await db.from('device_registrations').select('id')
          .eq('device_library_id', deviceLibId).eq('pass_serial', serial).maybeSingle();
        if (existing) return res.status(200).end(); // schon registriert
        const { error: insErr } = await db.from('device_registrations')
          .insert({ device_library_id: deviceLibId, pass_serial: serial, push_token: pushToken });
        if (insErr) { console.error('register insert failed:', insErr.message); return res.status(500).json({ error: insErr.message }); }
        return res.status(201).end();
      }

      // UNREGISTER: DELETE .../{serial}
      if (req.method === 'DELETE' && serial) {
        const auth = (req.headers['authorization'] || '').replace('ApplePass ', '');
        const { data: pass } = await db.from('passes').select('auth_token').eq('serial', serial).single();
        if (!pass || pass.auth_token !== auth) return res.status(401).end();
        await db.from('device_registrations').delete().eq('device_library_id', deviceLibId).eq('pass_serial', serial);
        return res.status(200).end();
      }

      // GET SERIALS: GET .../registrations/{passTypeId}?passesUpdatedSince=...
      if (req.method === 'GET' && !serial) {
        // Apple schickt das zuvor gelieferte lastUpdated-Tag als Query-Param zurueck.
        // Enthielt es ein '+', wird es beim URL-Dekodieren zu einem Leerzeichen -> wieder
        // zu '+' machen, sonst ist der Zeitvergleich kaputt und wir melden faelschlich 204.
        let since = url.searchParams.get('passesUpdatedSince');
        if (since) since = since.replace(/ /g, '+');
        const { data: regs } = await db.from('device_registrations').select('pass_serial').eq('device_library_id', deviceLibId);
        const serials = (regs || []).map(r => r.pass_serial);
        if (!serials.length) return res.status(204).end();
        let q = db.from('passes').select('serial,updated_at').in('serial', serials);
        if (since) q = q.gt('updated_at', since);
        const { data: passes } = await q;
        if (!passes || !passes.length) return res.status(204).end();
        // lastUpdated URL-sicher zurueckgeben (Z statt +00:00), damit das Tag den Rueckweg
        // ueber die URL unbeschadet uebersteht (kein '+' mehr).
        const maxIso = passes.reduce((m, p) => p.updated_at > m ? p.updated_at : m, '1970-01-01T00:00:00Z');
        const lastUpdated = new Date(maxIso).toISOString();
        return res.status(200).json({ serialNumbers: passes.map(p => p.serial), lastUpdated });
      }
    }

    // GET PASS: GET /passes/{passTypeId}/{serial}
    if (parts[0] === 'passes' && req.method === 'GET') {
      const serial = parts[2];
      const auth = (req.headers['authorization'] || '').replace('ApplePass ', '');
      const { data: pass } = await db.from('passes').select('auth_token').eq('serial', serial).single();
      if (!pass || pass.auth_token !== auth) return res.status(401).end();
      const built = await buildPassForSerial(db, serial);
      if (!built) return res.status(404).end();
      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Last-Modified', new Date(built.updatedAt || Date.now()).toUTCString());
      return res.status(200).send(built.buf);
    }

    return res.status(404).json({ error: 'unknown endpoint' });
  } catch (e) {
    console.error('v1 error:', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'server error' });
  }
}

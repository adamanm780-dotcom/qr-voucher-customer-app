// Dispatch-Endpoint: EIN QR-Ziel für beide Wallets.
//   /api/card?campaign=<id> | ?enroll=<token>  [&go=1]
//   iOS     -> 302 auf den unveränderten Apple-Pfad /api/pass
//   Android -> Landing mit "In Google Wallet" (Save-Link); &go=1 mintet + redirectet
import { createClient } from '@supabase/supabase-js';
import { mintCard } from '../lib/mint.mjs';
import { buildGoogleCard } from '../lib/googleview.mjs';
import { googleConfigured, ensureClass, upsertObject, saveLink } from './_google.mjs';

const PUBLIC_BASE = 'https://qr-voucher-customer-app.vercel.app';
const supa = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

export function walletTarget(ua = '') {
  const s = String(ua).toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'apple';
  if (/android/.test(s)) return 'android';
  return 'other';
}

// Minimal-HTML im dunklen FlowState-Look. text wird escaped übergeben (kein User-HTML).
function esc(x) { return String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function page(title, bodyHtml) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;
       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px}
  .card{width:100%;max-width:420px;text-align:center}
  h1{font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-.02em}
  p{color:#a1a1aa;font-size:15px;line-height:1.5;margin:0 0 24px}
  .btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 20px;
       border-radius:14px;border:0;cursor:pointer;text-decoration:none;font-size:16px;font-weight:600;
       background:linear-gradient(#ffffff,#e4e4e9);color:#09090b;
       box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 8px 24px rgba(0,0,0,.45)}
  .hint{margin-top:20px;font-size:13px;color:#71717a}
</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const campaign = url.searchParams.get('campaign');
    const enroll = url.searchParams.get('enroll');
    const go = url.searchParams.get('go');
    if (!campaign && !enroll) return res.status(400).send(page('Fehlt', '<h1>Ungültiger Link</h1><p>Kein Kampagnen-Parameter.</p>'));

    const query = enroll ? `enroll=${encodeURIComponent(enroll)}` : `campaign=${encodeURIComponent(campaign)}`;
    const target = walletTarget(req.headers['user-agent']);

    // Google-Flow nur für Android (über den Landing-Button). Kein offener Mint-Endpoint für jeden Browser.
    if (go && target === 'android' && googleConfigured()) {
      const db = supa();
      const m = await mintCard(db, { campaign, enroll });
      if (!m.ok) return res.status(m.status).send(page('Fehler', `<h1>Karte nicht verfügbar</h1><p>${esc(m.error)}</p>`));
      const heroUrl = `${PUBLIC_BASE}/api/card-image?campaign=${encodeURIComponent(m.camp.id)}`;
      const logoUrl = m.biz?.logo_url || null;
      const { classObj, object, oid } = buildGoogleCard({
        camp: m.camp, pass: { stamps: 0, remaining: m.remaining, startMs: null },
        theme: m.theme, slug: m.slug, serial: m.serial, org: m.theme.org, heroUrl, logoUrl,
      });
      await ensureClass(classObj);
      await upsertObject(object);
      try { await db.from('passes').update({ google_object_id: oid }).eq('serial', m.serial); } catch (e) { console.error('set google_object_id:', e); }
      res.setHeader('Location', saveLink({ id: oid, classId: classObj.id }));
      return res.status(302).end();
    }

    // iOS: unverändert auf den Apple-Pfad.
    if (target === 'apple') {
      res.setHeader('Location', `/api/pass?${query}`);
      return res.status(302).end();
    }

    // Android ohne Google-Config: freundlicher Platzhalter (kein Crash, bevor Credentials da sind).
    if (target === 'android' && !googleConfigured()) {
      return res.status(200).send(page('Bald verfügbar',
        `<h1>Google Wallet kommt in Kürze</h1>
         <p>Diese Karte lässt sich gleich in Google Wallet speichern. Bis dahin: über ein iPhone hinzufügen oder die Web-App nutzen (Chrome-Menü → „Zum Startbildschirm hinzufügen").</p>`));
    }

    // Android Landing (Tipp -> &go=1) ODER Desktop (Hinweis).
    if (target === 'android') {
      return res.status(200).send(page('In Google Wallet',
        `<h1>Karte hinzufügen</h1>
         <p>Tippe, um die Karte in deiner Google Wallet zu speichern.</p>
         <a class="btn" href="/api/card?${query}&go=1">In Google Wallet speichern</a>`));
    }
    return res.status(200).send(page('Auf dem Handy öffnen',
      `<h1>Bitte auf dem Handy öffnen</h1>
       <p>Scanne den QR-Code mit deinem Smartphone — iPhone landet in Apple Wallet, Android in Google Wallet.</p>
       <a class="btn" href="/api/pass?${query}">Trotzdem als Apple-Pass laden</a>`));
  } catch (e) {
    console.error('card dispatch error:', e && (e.stack || e.message || e));
    return res.status(500).send('<h1>Serverfehler</h1>');
  }
}

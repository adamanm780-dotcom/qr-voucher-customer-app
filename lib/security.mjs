// Gemeinsame Security-Helfer für alle API-Endpoints.
// - CORS: nur erlaubte Origins (statt "*").
// - Fehler-Ausgabe: nach außen generisch, Details nur ins Server-Log.
// - Mint-Drossel: begrenzt, wie viele Karten pro Kampagne in einem Zeitfenster
//   erzeugt werden dürfen (stoppt Skript-Missbrauch der öffentlichen Tresen-QRs,
//   ohne echten Gäste-Andrang zu blockieren). Braucht KEINE neue Tabelle.

// Erlaubte Browser-Origins (Dashboard/Cockpit liegen same-origin auf der App-Domain).
const ALLOWED_ORIGINS = new Set([
  'https://qr-voucher-customer-app.vercel.app',
  'http://localhost:3000',
]);

// Setzt CORS-Header. Spiegelt die Origin nur, wenn sie auf der Allowlist steht.
export function setCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
}

// Konstant-zeitiger String-Vergleich (gegen Timing-Angriffe auf Admin-Schlüssel).
// Reines JS, ohne Buffer-Längen-Leak: vergleicht immer über die volle Länge.
export function safeEqual(a, b) {
  const sa = String(a == null ? '' : a);
  const sb = String(b == null ? '' : b);
  let diff = sa.length ^ sb.length;
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Loggt den echten Fehler serverseitig und gibt eine generische Nachricht zurück.
export function failSafe(res, where, e, code = 500, publicMsg = 'Serverfehler.') {
  console.error(`${where}:`, e && (e.stack || e.message || e));
  return res.status(code).json({ ok: false, error: publicMsg });
}

// Client-IP aus den Vercel-Proxy-Headern (für optionale Diagnose/Logs).
export function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.headers['x-real-ip'] || 'unknown';
}

// Mint-Drossel pro Kampagne: true = erlaubt, false = Limit erreicht.
// Zählt neu erzeugte Pässe der Kampagne in zwei Fenstern. Großzügig genug für
// echten Andrang, hart gegen Skripte. Bei DB-Fehler: fail-open (echte Gäste
// nie blockieren), aber loggen.
const MINT_WINDOWS = [
  { ms: 10 * 60 * 1000, limit: 150 },  // max 150 / 10 Min
  { ms: 60 * 60 * 1000, limit: 600 },  // max 600 / 60 Min
];
export async function campaignMintAllowed(db, campaignId) {
  try {
    for (const w of MINT_WINDOWS) {
      const since = new Date(Date.now() - w.ms).toISOString();
      const { count, error } = await db
        .from('passes')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .gt('created_at', since);
      if (error) { console.error('mint-guard count error:', error.message); return true; }
      if ((count ?? 0) >= w.limit) {
        console.warn(`mint-guard: Kampagne ${campaignId} über Limit (${count} in ${w.ms / 60000} Min)`);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('mint-guard error:', e && (e.message || e));
    return true; // fail-open
  }
}

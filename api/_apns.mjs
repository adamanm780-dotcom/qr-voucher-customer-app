// APNs-Push für Wallet-Updates (HTTP/2 + JWT, ohne externe Lib).
// Sendet leeres Push an alle registrierten Geräte einer serial -> Wallet holt neuen Pass.
// Braucht ENV: APPLE_APNS_KEY_B64 (.p8 base64), APPLE_APNS_KEY_ID, APPLE_TEAM_ID.
import http2 from 'http2';
import crypto from 'crypto';

const TEAM_ID = process.env.APPLE_TEAM_ID || '4X4Z2XA87V';
const PASS_TYPE_ID = 'pass.com.lila.gutschein';
// Wallet-Pushes gehen an die PRODUKTIONS-APNs (auch bei Entwickler-Pässen).
const APNS_HOST = 'https://api.push.apple.com';

let cachedToken = null, cachedAt = 0;

function p8() {
  if (!process.env.APPLE_APNS_KEY_B64) return null;
  return Buffer.from(process.env.APPLE_APNS_KEY_B64, 'base64').toString('utf8');
}

// JWT für APNs (ES256), max 1h gültig -> wir cachen ~50min
function apnsJwt(nowSec) {
  if (cachedToken && (nowSec - cachedAt) < 3000) return cachedToken;
  const key = p8();
  if (!key) throw new Error('APNS_KEY fehlt');
  const header = { alg: 'ES256', kid: process.env.APPLE_APNS_KEY_ID };
  const payload = { iss: TEAM_ID, iat: nowSec };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  cachedToken = `${signingInput}.${sig.toString('base64url')}`;
  cachedAt = nowSec;
  return cachedToken;
}

// Ein leeres Push an ein Gerät senden
function pushOne(token, jwtToken, nowSec) {
  return new Promise((resolve) => {
    let client;
    try { client = http2.connect(APNS_HOST); } catch (e) { return resolve({ token, ok: false, err: String(e) }); }
    client.on('error', (e) => resolve({ token, ok: false, err: String(e) }));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      'authorization': `bearer ${jwtToken}`,
      'apns-topic': PASS_TYPE_ID,            // bei Wallet = Pass Type ID
      // KEIN apns-push-type:'background' — iOS drosselt background-Pushes.
      // PassKit-Update = leeres Payload {} an das Pass-Type-Topic.
      'content-type': 'application/json',
    });
    let status = 0, body = '';
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (d) => body += d);
    req.on('end', () => { client.close(); resolve({ token, ok: status === 200, status, body }); });
    req.on('error', (e) => { try { client.close(); } catch {} resolve({ token, ok: false, err: String(e) }); });
    req.write(JSON.stringify({}));  // leeres Payload -> Wallet holt Pass neu
    req.end();
  });
}

/**
 * Sendet Update-Push an alle Geräte, die für `serial` registriert sind.
 * @param {object} db supabase client
 * @param {string} serial
 * @returns {Promise<{sent:number, results:Array}>}
 */
export async function pushUpdate(db, serial) {
  if (!process.env.APPLE_APNS_KEY_B64) return { sent: 0, skipped: 'APNS nicht konfiguriert' };
  const { data: regs } = await db.from('device_registrations').select('push_token').eq('pass_serial', serial);
  if (!regs || !regs.length) return { sent: 0, note: 'keine Geräte registriert' };
  const nowSec = Math.floor(Date.now() / 1000);
  const jwtToken = apnsJwt(nowSec);
  const results = await Promise.all(regs.map(r => pushOne(r.push_token, jwtToken, nowSec)));
  // Nur ECHT tote Tokens (410 = Unregistered) aufräumen. 400 NICHT löschen
  // (kann Test-Token oder temporärer Fehler sein -> echte Geräte nicht verlieren).
  const dead = results.filter(r => r.status === 410).map(r => r.token);
  if (dead.length) await db.from('device_registrations').delete().in('push_token', dead);
  console.log('APNs pushUpdate:', JSON.stringify(results.map(r => ({ ok: r.ok, status: r.status, body: (r.body||'').slice(0,120) }))));
  return { sent: results.filter(r => r.ok).length, total: results.length, results };
}

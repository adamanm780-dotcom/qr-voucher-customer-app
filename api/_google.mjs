// Google-Wallet-Client — dependency-frei (nur Node-crypto + fetch), analog api/_apns.mjs.
//  - saveLink(): RS256-signierter "Save to Google Wallet"-JWT.
//  - ensureClass()/upsertObject()/patchObject(): GenericClass/Object via REST (OAuth2 SA-Token).
// Braucht Env: GOOGLE_WALLET_SA_JSON_B64 (komplette SA-JSON, base64), GOOGLE_WALLET_ISSUER_ID.
// Ohne Env -> googleConfigured()=false; Aufrufer überspringen Google sauber.
import crypto from 'crypto';

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SAVE_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';
const ORIGIN = 'https://qr-voucher-customer-app.vercel.app';

export function googleConfigured() {
  return !!(process.env.GOOGLE_WALLET_SA_JSON_B64 && process.env.GOOGLE_WALLET_ISSUER_ID);
}

function sa() {
  const b64 = process.env.GOOGLE_WALLET_SA_JSON_B64;
  if (!b64) throw new Error('GOOGLE_WALLET_SA_JSON_B64 fehlt');
  const j = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  if (!j.client_email || !j.private_key) throw new Error('SA-JSON unvollständig');
  return { email: j.client_email, key: j.private_key };
}

function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }

function signRS256(claims, privateKeyPem) {
  const signingInput = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKeyPem);
  return `${signingInput}.${sig.toString('base64url')}`;
}

// "Save to Google Wallet"-Link. objectOrRef = volles GenericObject ODER {id, classId}-Referenz.
export function saveLink(objectOrRef) {
  const { email, key } = sa();
  const claims = {
    iss: email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [ORIGIN],
    payload: { genericObjects: [objectOrRef] },
  };
  return `https://pay.google.com/gp/v/save/${signRS256(claims, key)}`;
}

// --- REST (OAuth2 Service-Account JWT-Bearer) ---
let _tok = null, _tokAt = 0;
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && (now - _tokAt) < 3000) return _tok;   // ~50min cachen
  const { email, key } = sa();
  const assertion = signRS256(
    { iss: email, scope: SAVE_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
    key
  );
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('google token: ' + JSON.stringify(j));
  _tok = j.access_token; _tokAt = now;
  return _tok;
}

async function api(method, path, body) {
  const tok = await accessToken();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: r.status, body: parsed };
}

// GenericClass anlegen, falls noch nicht vorhanden (idempotent).
export async function ensureClass(classObj) {
  const got = await api('GET', `/genericClass/${classObj.id}`);
  if (got.status === 200) return got;
  return api('POST', '/genericClass', classObj);
}

// GenericObject anlegen oder ersetzen.
export async function upsertObject(object) {
  const got = await api('GET', `/genericObject/${object.id}`);
  if (got.status === 200) return api('PUT', `/genericObject/${object.id}`, object);
  return api('POST', '/genericObject', object);
}

// Teil-Update eines GenericObject (Live-Stempel).
export async function patchObject(objectId, patch) {
  return api('PATCH', `/genericObject/${objectId}`, patch);
}

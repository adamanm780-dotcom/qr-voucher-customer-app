import assert from 'node:assert';
import crypto from 'crypto';

// Ephemeren RSA-Key erzeugen + als gefälschte SA-JSON in die Env legen.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const saJson = { client_email: 'svc@test.iam.gserviceaccount.com', private_key: pem };
process.env.GOOGLE_WALLET_SA_JSON_B64 = Buffer.from(JSON.stringify(saJson)).toString('base64');
process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000022222222';

const { googleConfigured, saveLink } = await import('../api/_google.mjs');

assert.strictEqual(googleConfigured(), true);

const link = saveLink({ id: '3388000000022222222.ABC-123', classId: '3388000000022222222.fs-test' });
assert.ok(link.startsWith('https://pay.google.com/gp/v/save/'), 'save-URL-Präfix');

const jwt = link.split('/save/')[1];
const [h, p, s] = jwt.split('.');
// Header = RS256
assert.strictEqual(JSON.parse(Buffer.from(h, 'base64url').toString()).alg, 'RS256');
// Payload enthält das Objekt + Claims
const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
assert.strictEqual(payload.iss, 'svc@test.iam.gserviceaccount.com');
assert.strictEqual(payload.typ, 'savetowallet');
assert.strictEqual(payload.payload.genericObjects[0].id, '3388000000022222222.ABC-123');
// Signatur verifiziert gegen den public key
const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
assert.strictEqual(ok, true, 'RS256-Signatur gültig');

// Nicht konfiguriert -> false
delete process.env.GOOGLE_WALLET_SA_JSON_B64;
const fresh = await import('../api/_google.mjs?nocache=' + Date.now());
assert.strictEqual(fresh.googleConfigured(), false);

console.log('test-google-jwt OK');

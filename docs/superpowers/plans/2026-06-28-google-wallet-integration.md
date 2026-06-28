# Google-Wallet-Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android-Gäste bekommen dieselbe Karte wie iPhone-Gäste — in Google Wallet, mit Geräte-Auto-Erkennung, Ein-Tipp-Hinzufügen und Live-Update beim Stempeln; der Apple-Pfad bleibt byte-identisch.

**Architecture:** Additiv neben dem Apple-Pfad. Geteilte Mint-Logik (`lib/mint.mjs`) versorgt beide Wallets. Ein dependency-freier Google-Client (`api/_google.mjs`, nur Node-`crypto` + `fetch`) signiert den RS256-„Save"-JWT, holt OAuth2-Tokens und legt/patcht GenericClass/Object via REST. Ein neuer Dispatch-Endpoint (`api/card.mjs`) erkennt das OS und leitet iOS auf den unveränderten `/api/pass`-Pfad bzw. Android auf den Google-Save-Link. Stempeln benachrichtigt beide Wallets (`lib/walletpush.mjs`).

**Tech Stack:** Vanilla Node ESM, Vercel Serverless, Supabase (Postgres), Node-`crypto`, global `fetch` (Node 18+), `sharp` (vorhanden). KEINE neuen npm-Abhängigkeiten.

## Global Constraints

- **Keine neuen npm-Pakete.** Google nur mit Node-`crypto` + `fetch` (+ vorhandenes `sharp`/`@supabase/supabase-js`).
- **Apple-Pfad byte-identisch** — kein Regress an `/api/pass`-Ausgabe (User-Regel: „Nichts Gebautes rückbauen").
- **Security-Parität (Pflicht):** Drossel `campaignMintAllowed` auf dem Google-Mint-Pfad; SA-Key nur als Base64-Env, nie im Client; „Save"-JWT serverseitig signiert; kein `innerHTML` mit User-Daten in der Landing.
- **Env-gated:** Ohne `GOOGLE_WALLET_*`-Env läuft alles inaktiv (kein Crash), Apple voll funktionsfähig.
- **Helper-Konvention:** Dateien in `api/` mit führendem `_` sind Helfer, keine Routes (wie `api/_apns.mjs`).
- **Tests:** Kein Jest. Pure Funktionen → `scripts/test-*.mjs` mit `node:assert` (Konvention: vorhandene `scripts/test-*.mjs`). Live-Google-Schritte sind **gated** auf vorhandene Credentials.
- **UI-Copy Deutsch.** Verbotene Farben in der Landing: Teal/Cyan, Gold, Grün, Lila-auf-Weiß. Dunkles FlowState-Design (`#09090b`, weiße Pillen).
- **Public Base URL:** `https://qr-voucher-customer-app.vercel.app` (Google muss Hero/Logo öffentlich erreichen — Prod ist public, Preview ist auth-gated).
- **Env-Vars (User liefert später):** `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON_B64` (komplette SA-JSON, base64).
- **Deploy:** aus dem Ordner `npx vercel --prod --yes`, danach `npx vercel promote <neue-url> --yes`. Live-Check per `curl … | grep <marker>`.

---

### Task 1: DB-Migration — `passes.google_object_id`

**Files:**
- Create: `db/google-wallet.sql`
- Reference: `db/schema.sql` (passes-Tabelle — vor dem Apply ansehen)

**Interfaces:**
- Produces: Nullable Spalte `passes.google_object_id text` — gesetzt, wenn eine Google-Karte für eine `serial` angelegt wurde. `lib/walletpush.mjs` (Task 7) und `api/card.mjs` (Task 6) lesen/schreiben sie.

- [ ] **Step 1: Migrations-SQL schreiben**

`db/google-wallet.sql`:
```sql
-- Google-Wallet-Integration: Verknüpft eine ausgegebene Karte (serial) mit ihrem
-- Google-Wallet-GenericObject, damit Live-Updates das richtige Objekt patchen.
-- Additiv + idempotent. Apple-Pfad unberührt.
alter table public.passes
  add column if not exists google_object_id text;

comment on column public.passes.google_object_id is
  'Google Wallet GenericObject-ID (<issuerId>.<serial>); null = keine Google-Karte ausgegeben.';
```

- [ ] **Step 2: Migration im richtigen Supabase-Projekt anwenden**

Supabase-Projekt **„voucher flow" `uyqjaasrnqkvuhgtnjbj`** (NICHT „customer app"). Supabase-Dashboard → SQL Editor → Inhalt von `db/google-wallet.sql` einfügen → Run.

- [ ] **Step 3: Spalte verifizieren**

Run im SQL Editor:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'passes' and column_name = 'google_object_id';
```
Expected: eine Zeile, `text`, `YES`.

- [ ] **Step 4: Commit**

```bash
git add db/google-wallet.sql
git commit -m "feat(db): add passes.google_object_id for Google Wallet linkage"
```

---

### Task 2: `lib/mint.mjs` — geteilte Mint-Logik (Refactor aus pass.mjs)

**Files:**
- Create: `lib/mint.mjs`
- Create: `scripts/test-mint.mjs`
- Modify: `api/pass.mjs` (enroll- + campaign-Branch → `mintCard`; `mintFor`/`newSerial`/`serialPrefix`/`fmtDate` entfernen, aus `lib/mint.mjs` importieren)

**Interfaces:**
- Produces:
  - `mintData(camp, theme, authToken) -> { remaining, data }` — PURE. `data` exakt wie pass.mjs heute (title, authToken, ...theme, stampGoal, stamps:0, reward, value, remaining, config, validUntil, startMs:null).
  - `mintCard(db, { campaign, enroll }) -> Promise<{ ok, status?, error?, camp, biz, theme, slug, serial, authToken, type, key, data, remaining }>` — lädt Kampagne (per id ODER enroll_token), wendet Drossel an, legt `passes`-Zeile an.
- Consumes: `themeFor`, `assetKey`, `campaignDir` (`lib/theme.mjs`); `campaignMintAllowed` (`lib/security.mjs`); `initialRemaining` (`lib/cards.mjs`); `crypto`.

- [ ] **Step 1: Failing test schreiben**

`scripts/test-mint.mjs`:
```js
import assert from 'node:assert';
import { mintData } from '../lib/mint.mjs';

const theme = { prefix: 'default-', org: 'Café Test', bg: 'rgb(20,20,30)', fg: 'rgb(255,255,255)', label: 'rgb(230,230,250)', isDefault: true, custom: false };

// Stempelkarte: remaining null, stamps 0, Felder durchgereicht
const camp1 = { type: 'stampcard', title: 'Treuekarte', stamp_goal: 10, reward: 'Gratis Kaffee', value: null, config: {} };
const r1 = mintData(camp1, theme, 'tok123');
assert.strictEqual(r1.remaining, null);
assert.strictEqual(r1.data.stamps, 0);
assert.strictEqual(r1.data.stampGoal, 10);
assert.strictEqual(r1.data.authToken, 'tok123');
assert.strictEqual(r1.data.org, 'Café Test');
assert.strictEqual(r1.data.startMs, null);

// Coupon ohne valid_until -> Default-Datum
const camp2 = { type: 'coupon', title: 'Gutschein', stamp_goal: null, reward: null, value: '20%', config: {} };
const r2 = mintData(camp2, theme, 'tok');
assert.strictEqual(r2.data.validUntil, '31.12.2026');

// multipass: remaining aus config.max_uses
const camp3 = { type: 'multipass', title: '10er', config: { max_uses: 10 } };
const r3 = mintData(camp3, theme, 'tok');
assert.strictEqual(r3.remaining, 10);
assert.strictEqual(r3.data.remaining, 10);

console.log('test-mint OK');
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `node scripts/test-mint.mjs`
Expected: FAIL — `Cannot find module '../lib/mint.mjs'`.

- [ ] **Step 3: `lib/mint.mjs` implementieren**

```js
// Geteilte Mint-Logik für Apple (api/pass.mjs) UND Google (api/card.mjs).
// Eine Quelle der Wahrheit: Kampagne laden, Drossel, Theme, passes-Zeile anlegen.
import crypto from 'crypto';
import { themeFor, assetKey, campaignDir } from './theme.mjs';
import { campaignMintAllowed } from './security.mjs';
import { initialRemaining } from './cards.mjs';

// ISO -> "DD.MM.YYYY" (Gültig-bis). Leer bei ungültig.
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function serialPrefix(slug) {
  return (slug || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FS';
}
export function newSerial(slug) {
  return serialPrefix(slug) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// PURE: Pass-data-Felder + initialer Restzähler. Identisch zu pass.mjs (Bestandsverhalten).
export function mintData(camp, theme, authToken) {
  const type = camp.type;
  const config = camp.config || {};
  const remaining = initialRemaining(type, config);
  let validUntil = config.valid_until ? fmtDate(config.valid_until) : null;
  if (type === 'coupon' && !validUntil) validUntil = '31.12.2026';
  const data = {
    title: camp.title, authToken, ...theme,
    stampGoal: camp.stamp_goal, stamps: 0,
    reward: camp.reward, value: camp.value,
    remaining, config, validUntil,
    startMs: null,
  };
  return { remaining, data };
}

// Kampagne per id ODER enroll_token laden, Drossel anwenden, passes-Zeile anlegen.
export async function mintCard(db, { campaign, enroll }) {
  const q = enroll
    ? db.from('campaigns').select('*').eq('enroll_token', enroll).single()
    : db.from('campaigns').select('*').eq('id', campaign).single();
  const { data: camp, error } = await q;
  if (error || !camp) return { ok: false, status: 404, error: 'Kampagne nicht gefunden' };

  if (!(await campaignMintAllowed(db, camp.id))) {
    return { ok: false, status: 429, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' };
  }

  const { data: biz } = await db.from('businesses')
    .select('name,slug,color_bg,color_text,logo_url')
    .eq('id', camp.business_id).maybeSingle();
  const theme = themeFor(biz);
  const type = camp.type;
  const key = campaignDir(biz?.slug, camp.id) || assetKey(type, camp.stamp_goal, theme.prefix);
  const serial = newSerial(biz?.slug);
  const authToken = crypto.randomBytes(16).toString('hex');
  const { remaining, data } = mintData(camp, theme, authToken);

  const { error: insErr } = await db.from('passes').insert({
    campaign_id: camp.id, business_id: camp.business_id, serial,
    auth_token: authToken, stamps: 0, status: 'active',
    ...(remaining != null ? { remaining } : {}),
  });
  if (insErr) return { ok: false, status: 500, error: 'Karte konnte nicht angelegt werden' };

  return { ok: true, camp, biz, theme, slug: biz?.slug || null, serial, authToken, type, key, data, remaining };
}
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `node scripts/test-mint.mjs`
Expected: `test-mint OK`.

- [ ] **Step 5: `api/pass.mjs` auf `mintCard`/`mintData` umstellen**

In `api/pass.mjs` Import ergänzen (oben bei den anderen lib-Imports):
```js
import { mintCard } from '../lib/mint.mjs';
```
Lokale Helfer `fmtDate`, `serialPrefix`, `newSerial`, `mintFor` aus `pass.mjs` **löschen** (jetzt in `lib/mint.mjs`). `buildPass` + `certs`/`supa`/Demo-Branch bleiben unverändert.

Die beiden Branches `else if (enroll) { … }` und `else if (campaign) { … }` durch EINEN gemeinsamen Branch ersetzen:
```js
    } else if (enroll || campaign) {
      const db = supa();
      const m = await mintCard(db, { campaign, enroll });
      if (!m.ok) {
        if (m.status === 429) res.setHeader('Retry-After', '600');
        return res.status(m.status).json({ error: m.error });
      }
      key = m.key; serial = m.serial; type = m.type; data = m.data;
    } else {
```
(Der finale Block `const buf = buildPass({ key, serial, type, data }); …` bleibt unverändert.)

- [ ] **Step 6: Apple-Pfad-Smoke gegen lokalen Funktionslauf**

Run (Demo-Pass braucht keine DB, prüft buildPass + Imports):
```bash
node -e "import('./api/pass.mjs').then(()=>console.log('pass.mjs lädt'))"
```
Expected: `pass.mjs lädt` (keine Import-/Syntaxfehler). Demo-Pass end-to-end wird in Task 10 live verifiziert.

- [ ] **Step 7: Commit**

```bash
git add lib/mint.mjs scripts/test-mint.mjs api/pass.mjs
git commit -m "refactor(pass): extract shared mint logic to lib/mint.mjs"
```

---

### Task 3: `api/_google.mjs` — Google-Client (JWT / OAuth / REST)

**Files:**
- Create: `api/_google.mjs`
- Create: `scripts/test-google-jwt.mjs`

**Interfaces:**
- Produces:
  - `googleConfigured() -> boolean` — true nur wenn beide Env-Vars gesetzt.
  - `saveLink(objectOrRef) -> string` — `https://pay.google.com/gp/v/save/<RS256-JWT>` mit `payload.genericObjects:[objectOrRef]`.
  - `ensureClass(classObj) -> Promise<{status, body}>` — GET, sonst POST (idempotent).
  - `upsertObject(object) -> Promise<{status, body}>` — PUT wenn vorhanden, sonst POST.
  - `patchObject(objectId, patch) -> Promise<{status, body}>`.
- Consumes: `crypto`, global `fetch`. Env: `GOOGLE_WALLET_SA_JSON_B64`, `GOOGLE_WALLET_ISSUER_ID`.

- [ ] **Step 1: Failing test schreiben (offline, ephemerer RSA-Key)**

`scripts/test-google-jwt.mjs`:
```js
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
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `node scripts/test-google-jwt.mjs`
Expected: FAIL — `Cannot find module '../api/_google.mjs'`.

- [ ] **Step 3: `api/_google.mjs` implementieren**

```js
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
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `node scripts/test-google-jwt.mjs`
Expected: `test-google-jwt OK`.

- [ ] **Step 5: Commit**

```bash
git add api/_google.mjs scripts/test-google-jwt.mjs
git commit -m "feat(google): dependency-free Google Wallet client (RS256 JWT + REST)"
```

---

### Task 4: `lib/googleview.mjs` — GenericObject-Builder

**Files:**
- Create: `lib/googleview.mjs`
- Create: `scripts/test-googleview.mjs`

**Interfaces:**
- Produces:
  - `rgbToHex(rgb) -> string` (`"rgb(20,20,30)"` → `"#14141e"`; Fallback `"#6b5cff"`).
  - `classId(slug) -> string` (`<issuerId>.fs-<sanitized-slug>`).
  - `objectId(serial) -> string` (`<issuerId>.<sanitized-serial>`).
  - `buildGoogleCard({ camp, pass, theme, slug, serial, org, heroUrl, logoUrl }) -> { classObj, object, cid, oid }`.
  - `googlePatchFor({ camp, pass, theme, serial, org, heroUrl }) -> { textModulesData, heroImage? }` — nur die volatilen Felder fürs Live-Update.
- Consumes: `cardView` (`lib/passview.mjs`). Env: `GOOGLE_WALLET_ISSUER_ID`.

- [ ] **Step 1: Failing test schreiben**

`scripts/test-googleview.mjs`:
```js
import assert from 'node:assert';
process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000022222222';
const { rgbToHex, classId, objectId, buildGoogleCard, googlePatchFor } = await import('../lib/googleview.mjs');

assert.strictEqual(rgbToHex('rgb(20, 20, 30)'), '#14141e');
assert.strictEqual(rgbToHex('kaputt'), '#6b5cff');
assert.strictEqual(classId('café-hilda'), '3388000000022222222.fs-cafhilda');
assert.strictEqual(objectId('NINI-AB12CD'), '3388000000022222222.NINI-AB12CD');

const theme = { bg: 'rgb(20,20,30)', org: 'Café Hilda', isDefault: true };
const camp = { type: 'stampcard', title: 'Treuekarte', stamp_goal: 10, reward: 'Gratis Kaffee', config: {} };
const pass = { stamps: 3 };
const { classObj, object, cid, oid } = buildGoogleCard({
  camp, pass, theme, slug: 'cafe-hilda', serial: 'CAFE-AB12CD', org: 'Café Hilda',
  heroUrl: 'https://x/h.png', logoUrl: 'https://x/l.png',
});
assert.strictEqual(object.id, oid);
assert.strictEqual(object.classId, cid);
assert.strictEqual(object.hexBackgroundColor, '#14141e');
assert.strictEqual(object.barcode.value, 'CAFE-AB12CD');
assert.strictEqual(object.heroImage.sourceUri.uri, 'https://x/h.png');
// Stempelzahl als Textzeile (immer lesbar)
const stamp = object.textModulesData.find(r => r.body === '3/10');
assert.ok(stamp, 'STEMPEL-Zeile 3/10 vorhanden');

// Patch enthält nur volatile Felder
const patch = googlePatchFor({ camp, pass: { stamps: 4 }, theme, serial: 'CAFE-AB12CD', org: 'Café Hilda' });
assert.ok(patch.textModulesData.find(r => r.body === '4/10'), 'Patch zeigt 4/10');
assert.strictEqual(patch.id, undefined, 'Patch enthält keine id');

console.log('test-googleview OK');
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `node scripts/test-googleview.mjs`
Expected: FAIL — `Cannot find module '../lib/googleview.mjs'`.

- [ ] **Step 3: `lib/googleview.mjs` implementieren**

```js
// Baut Google-Wallet GenericClass/Object aus einer Karte.
// Nutzt cardView() (lib/passview.mjs) -> Apple & Google zeigen dieselben Felder, nie Divergenz.
import { cardView } from './passview.mjs';

const issuer = () => process.env.GOOGLE_WALLET_ISSUER_ID || '';

export function rgbToHex(rgb) {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(rgb || '');
  if (!m) return '#6b5cff';
  const h = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
}

export function classId(slug) {
  const s = (slug || 'default').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'default';
  return `${issuer()}.fs-${s}`;
}
export function objectId(serial) {
  return `${issuer()}.${String(serial).replace(/[^A-Za-z0-9_.-]/g, '')}`;
}

// Apple-Felder (header/primary/secondary/auxiliary) -> Google textModulesData.
function fieldRows(view) {
  const st = view.structure || {};
  const all = [
    ...(st.headerFields || []),
    ...(st.primaryFields || []),
    ...(st.secondaryFields || []),
    ...(st.auxiliaryFields || []),
  ].filter(f => f && f.value !== undefined && f.value !== null && String(f.value) !== '');
  return all.map((f, i) => ({ id: `row${i}`, header: String(f.label || ''), body: String(f.value) }));
}

export function buildGoogleCard({ camp, pass, theme, slug, serial, org, heroUrl, logoUrl }) {
  const view = cardView(camp, pass || {}, theme || {}, { nowMs: Date.now(), startMs: (pass && pass.startMs) || null });
  const cid = classId(slug);
  const oid = objectId(serial);
  const name = org || (theme && theme.org) || 'FlowState';

  const classObj = {
    id: cid,
    issuerName: name,
    reviewStatus: 'UNDER_REVIEW',
  };

  const object = {
    id: oid,
    classId: cid,
    state: 'ACTIVE',
    cardTitle: { defaultValue: { language: 'de', value: name } },
    header: { defaultValue: { language: 'de', value: camp.title || 'Karte' } },
    hexBackgroundColor: rgbToHex(theme && theme.bg),
    textModulesData: fieldRows(view),
    barcode: { type: 'QR_CODE', value: String(serial), alternateText: String(serial) },
    ...(logoUrl ? { logo: { sourceUri: { uri: logoUrl } } } : {}),
    ...(heroUrl ? { heroImage: { sourceUri: { uri: heroUrl } } } : {}),
  };

  return { classObj, object, cid, oid };
}

// Nur die volatilen Felder fürs Live-Update (Stempelzahl/Stand; Hero nur wenn neu gerendert).
export function googlePatchFor({ camp, pass, theme, serial, org, heroUrl }) {
  const view = cardView(camp, pass || {}, theme || {}, { nowMs: Date.now(), startMs: (pass && pass.startMs) || null });
  return {
    textModulesData: fieldRows(view),
    ...(heroUrl ? { heroImage: { sourceUri: { uri: heroUrl } } } : {}),
  };
}
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `node scripts/test-googleview.mjs`
Expected: `test-googleview OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/googleview.mjs scripts/test-googleview.mjs
git commit -m "feat(google): GenericObject builder mirroring Apple card fields"
```

---

### Task 5: `api/card-image.mjs` — Hero-Format (3:1)

**Files:**
- Modify: `api/card-image.mjs` (Parameter `format=hero` → 2064×688 PNG via sharp)
- Create: `scripts/test-hero-fit.mjs`

**Interfaces:**
- Produces: `GET /api/card-image?campaign=<id>&format=hero` → PNG 2064×688 (3:1), nutzt das pro-Aktion-Design (`campaignDir`) bzw. Mechanik-Strip als Fallback. Wird als `heroUrl` an Google übergeben.
- Consumes: `sharp` (vorhanden), bestehende Asset-Logik (`loadAssets`/`campaignDir`/`assetKey`).

- [ ] **Step 1: Failing test schreiben (reines sharp-Fit, ohne DB)**

`scripts/test-hero-fit.mjs`:
```js
import assert from 'node:assert';
import sharp from 'sharp';

// 1125x432-Quelle (Apple-Strip-Ratio) -> auf 3:1 fitten.
const src = await sharp({ create: { width: 1125, height: 432, channels: 3, background: '#222' } }).png().toBuffer();
const out = await sharp(src).resize(2064, 688, { fit: 'cover', position: 'center' }).png().toBuffer();
const meta = await sharp(out).metadata();
assert.strictEqual(meta.width, 2064);
assert.strictEqual(meta.height, 688);
assert.strictEqual(Math.round((meta.width / meta.height) * 100) / 100, 3);
console.log('test-hero-fit OK');
```

- [ ] **Step 2: Test laufen lassen → muss bestehen (verifiziert die Fit-Strategie)**

Run: `node scripts/test-hero-fit.mjs`
Expected: `test-hero-fit OK`. (Dieser Test fixiert die Resize-Parameter, die wir in den Endpoint übernehmen.)

- [ ] **Step 3: `api/card-image.mjs` um `format=hero` erweitern**

Import oben ergänzen:
```js
import sharp from 'sharp';
```
Den Sende-Block am Ende (aktuell `res.setHeader('Content-Type','image/png'); … return res.status(200).send(assets['strip@3x.png']);`) ersetzen durch:
```js
    res.setHeader('Cache-Control', 'public, max-age=300');
    const format = url.searchParams.get('format');
    if (format === 'hero') {
      // Google-Hero = 3:1 (1032×344 -> 2× für Schärfe). User-Design wird gecovered/zentriert.
      const hero = await sharp(assets['strip@3x.png'])
        .resize(2064, 688, { fit: 'cover', position: 'center' })
        .png().toBuffer();
      res.setHeader('Content-Type', 'image/png');
      return res.status(200).send(hero);
    }
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(assets['strip@3x.png']);
```

- [ ] **Step 4: Modul lädt fehlerfrei**

Run: `node -e "import('./api/card-image.mjs').then(()=>console.log('card-image lädt'))"`
Expected: `card-image lädt`. (Live-Bild wird in Task 10 per curl auf Prod geprüft.)

- [ ] **Step 5: Commit**

```bash
git add api/card-image.mjs scripts/test-hero-fit.mjs
git commit -m "feat(card-image): add 3:1 hero format for Google Wallet"
```

---

### Task 6: `api/card.mjs` — Dispatch-Landing (OS-Erkennung)

**Files:**
- Create: `api/card.mjs`
- Create: `scripts/test-wallet-target.mjs`

**Interfaces:**
- Produces:
  - `walletTarget(ua) -> 'apple' | 'android' | 'other'` (named export, PURE).
  - `default handler` — `GET /api/card?campaign=<id>|enroll=<token>[&go=1]`:
    - **apple** → 302 auf `/api/pass?<gleiche Query>` (unveränderter Apple-Pfad).
    - **android, ohne `go`** → HTML-Landing (dunkel) mit Button → `/api/card?…&go=1`.
    - **android, `go=1`** → mint (`mintCard`) + GenericClass/Object anlegen + `passes.google_object_id` setzen + 302 auf `saveLink`.
    - **android, Google nicht konfiguriert** → freundliche „kommt in Kürze"-Seite (kein Crash).
    - **other (Desktop)** → Hinweisseite „auf dem Handy öffnen".
- Consumes: `mintCard` (Task 2); `buildGoogleCard` (Task 4); `googleConfigured`/`ensureClass`/`upsertObject`/`saveLink` (Task 3); Supabase.

- [ ] **Step 1: Failing test schreiben (UA-Erkennung, offline)**

`scripts/test-wallet-target.mjs`:
```js
import assert from 'node:assert';
const { walletTarget } = await import('../api/card.mjs');

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari';
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36';
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

assert.strictEqual(walletTarget(iphone), 'apple');
assert.strictEqual(walletTarget(android), 'android');
assert.strictEqual(walletTarget(desktop), 'other');
assert.strictEqual(walletTarget(''), 'other');
console.log('test-wallet-target OK');
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `node scripts/test-wallet-target.mjs`
Expected: FAIL — `Cannot find module '../api/card.mjs'`.

- [ ] **Step 3: `api/card.mjs` implementieren**

```js
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

    // Android + go=1: minten, Google-Objekt anlegen, zum Save-Link weiterleiten.
    if (target === 'android' && go) {
      const db = supa();
      const m = await mintCard(db, { campaign, enroll });
      if (!m.ok) return res.status(m.status).send(page('Fehler', `<h1>Karte nicht verfügbar</h1><p>${esc(m.error)}</p>`));
      const heroUrl = `${PUBLIC_BASE}/api/card-image?campaign=${encodeURIComponent(m.camp.id)}&format=hero`;
      const logoUrl = m.biz?.logo_url || null;
      const { classObj, object, oid } = buildGoogleCard({
        camp: m.camp, pass: { stamps: 0, remaining: m.remaining, startMs: null },
        theme: m.theme, slug: m.slug, serial: m.serial, org: m.theme.org, heroUrl, logoUrl,
      });
      await ensureClass(classObj);
      await upsertObject(object);
      await db.from('passes').update({ google_object_id: oid }).eq('serial', m.serial);
      res.setHeader('Location', saveLink({ id: oid, classId: classObj.id }));
      return res.status(302).end();
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
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `node scripts/test-wallet-target.mjs`
Expected: `test-wallet-target OK`.

- [ ] **Step 5: Commit**

```bash
git add api/card.mjs scripts/test-wallet-target.mjs
git commit -m "feat(google): OS-detecting dispatch landing (Apple redirect / Google save)"
```

---

### Task 7: `lib/walletpush.mjs` — Live-Update an beide Wallets

**Files:**
- Create: `lib/walletpush.mjs`
- Modify: `api/redeem.mjs` (Import + 6× `pushUpdate(db, serial)` → `notifyWallets(db, serial)`)

**Interfaces:**
- Produces: `notifyWallets(db, serial) -> Promise<void>` — feuert Apple-APNs (no-op ohne Gerät) UND Google-Patch (no-op ohne Config/`google_object_id`). Apple zuerst; Google-Fehler werden gefangen.
- Consumes: `pushUpdate` (`api/_apns.mjs`); `googleConfigured`/`patchObject` (`api/_google.mjs`); `themeFor` (`lib/theme.mjs`); `googlePatchFor` (`lib/googleview.mjs`).

- [ ] **Step 1: `lib/walletpush.mjs` implementieren**

```js
// Eine Stelle, die beim Stempeln/Einlösen BEIDE Wallets aktualisiert.
//  - Apple: leeres APNs-Push (no-op, wenn kein Gerät registriert).
//  - Google: GenericObject patchen (no-op, wenn nicht konfiguriert oder keine google_object_id).
import { pushUpdate } from '../api/_apns.mjs';
import { googleConfigured, patchObject } from '../api/_google.mjs';
import { themeFor } from './theme.mjs';
import { googlePatchFor } from './googleview.mjs';

export async function notifyWallets(db, serial) {
  // Apple zuerst — Bestandsverhalten, darf nie ausfallen wegen Google.
  try { await pushUpdate(db, serial); } catch (e) { console.error('apns push:', e); }

  // Google — nur wenn konfiguriert und diese Karte eine Google-Karte ist.
  try {
    if (!googleConfigured()) return;
    const { data: pass } = await db.from('passes').select('*').eq('serial', serial).maybeSingle();
    if (!pass || !pass.google_object_id) return;
    const { data: camp } = await db.from('campaigns').select('*').eq('id', pass.campaign_id).maybeSingle();
    if (!camp) return;
    const { data: biz } = await db.from('businesses')
      .select('name,slug,color_bg,color_text,logo_url').eq('id', pass.business_id).maybeSingle();
    const theme = themeFor(biz);
    const patch = googlePatchFor({ camp, pass, theme, serial, org: theme.org });
    await patchObject(pass.google_object_id, patch);
  } catch (e) { console.error('gwallet patch:', e); }
}
```

- [ ] **Step 2: `api/redeem.mjs` verdrahten**

Import-Zeile `import { pushUpdate } from './_apns.mjs';` ersetzen durch:
```js
import { notifyWallets } from '../lib/walletpush.mjs';
```
Alle 6 Vorkommen `try { await pushUpdate(db, serial); } catch (e) { console.error('push:', e); }` ersetzen durch:
```js
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
```
(Vorkommen: multipass, balance, access-Zeitpass, access-klassisch, coupon, stamp-redeemReward, normaler stamp — `replace_all`.)

- [ ] **Step 3: Module laden fehlerfrei + Stempel-Mechanik-Test grün**

Run:
```bash
node -e "import('./api/redeem.mjs').then(()=>console.log('redeem lädt'))"
node scripts/test-mechanics.mjs
```
Expected: `redeem lädt`, und `test-mechanics.mjs` läuft ohne neue Fehler (Stempel-Logik unverändert). Falls `test-mechanics.mjs` Live-DB braucht und ohne Env nicht läuft: nur den Lade-Smoke werten, Stempeln live in Task 10.

- [ ] **Step 4: Commit**

```bash
git add lib/walletpush.mjs api/redeem.mjs
git commit -m "feat(google): live-update both wallets on stamp/redeem"
```

---

### Task 8: Dashboard-QR auf `/api/card` umstellen

**Files:**
- Modify: `public/dashboard.html` (QR-Link `/api/pass?` → `/api/card?`, ~Zeile 2346–2349)

**Interfaces:**
- Consumes: bestehende `token`/`campId`/`isStamp`-Variablen im QR-Block.
- Produces: Neu generierte QR-Codes zeigen auf den Dispatcher. Alte gedruckte Apple-QRs (`/api/pass`) laufen weiter.

- [ ] **Step 1: Link-Zeilen ersetzen**

Block (aktuell):
```js
      const url = isStamp
        ? `${location.origin}/api/pass?enroll=${token}`
        : `${location.origin}/api/pass?campaign=${campId}`;
```
ersetzen durch:
```js
      // Dispatcher erkennt iOS/Android -> richtige Wallet (Apple-Pass bleibt unter /api/pass erreichbar).
      const url = isStamp
        ? `${location.origin}/api/card?enroll=${token}`
        : `${location.origin}/api/card?campaign=${campId}`;
```

- [ ] **Step 2: Marker prüfen**

Run: `grep -n "api/card?" public/dashboard.html`
Expected: zwei Treffer (`enroll` + `campaign`).

- [ ] **Step 3: Commit**

```bash
git add public/dashboard.html
git commit -m "feat(dashboard): point card QR to OS-detecting dispatcher"
```

---

### Task 9: Setup-Anleitung + `.env.example`

**Files:**
- Create: `GOOGLE-WALLET-SETUP.md`
- Modify: `.env.example` (zwei Google-Vars ergänzen)

**Interfaces:**
- Produces: Klick-für-Klick-Anleitung, die der User OHNE Vorwissen befolgen kann, um die zwei Env-Vars zu erzeugen.

- [ ] **Step 1: `.env.example` ergänzen**

Am Ende anhängen:
```
# --- Google Wallet (Android) ---
# Aus Google Pay & Wallet Console (Issuer onboarding; Freigabe kann Tage dauern):
GOOGLE_WALLET_ISSUER_ID=
# Komplette Service-Account-JSON-Datei, base64-kodiert (enthält client_email + private_key):
GOOGLE_WALLET_SA_JSON_B64=
```

- [ ] **Step 2: `GOOGLE-WALLET-SETUP.md` schreiben**

```markdown
# Google Wallet einrichten (für FlowState Wallet)

Ziel: zwei Werte erzeugen — `GOOGLE_WALLET_ISSUER_ID` und `GOOGLE_WALLET_SA_JSON_B64` —
und in Vercel + lokale `.env` eintragen. Danach funktioniert Android automatisch.

> Hinweis: Bis das alles gesetzt ist, läuft alles unverändert weiter. iPhone ist nicht betroffen.
> Android-Gäste sehen so lange „Google Wallet kommt in Kürze".

## 1. Google-Cloud-Projekt
1. https://console.cloud.google.com → oben Projektauswahl → **Neues Projekt** → Name z.B. „FlowState Wallet" → Erstellen.
2. Sicherstellen, dass das neue Projekt oben ausgewählt ist.

## 2. Google Wallet API aktivieren
1. https://console.cloud.google.com/apis/library → nach **Google Wallet API** suchen → **Aktivieren**.

## 3. Service-Account + JSON-Key
1. https://console.cloud.google.com/iam-admin/serviceaccounts → **Dienstkonto erstellen** →
   Name z.B. „wallet-signer" → Erstellen und fortfahren → (keine Rolle nötig) → Fertig.
2. Auf das Dienstkonto klicken → Tab **Schlüssel** → **Schlüssel hinzufügen** → **Neuen Schlüssel** →
   Typ **JSON** → die Datei wird heruntergeladen (z.B. `wallet-signer-xxxx.json`). **Gut aufbewahren.**
3. Die `client_email` aus dieser JSON merken (brauchen wir in Schritt 4 für die Berechtigung).

## 4. Google Pay & Wallet Console (Issuer-ID + Zugriff)
1. https://pay.google.com/business/console → mit demselben Google-Konto anmelden →
   **Google Wallet API** beantragen/onboarden (Firmendaten ausfüllen).
2. Nach Freigabe gibt es eine **Issuer-ID** (lange Zahl) → das ist `GOOGLE_WALLET_ISSUER_ID`.
   ⏳ Die Freigabe kann mehrere Tage dauern.
3. In der Wallet Console unter **Users / Zugriffsverwaltung** die `client_email` des Dienstkontos
   aus Schritt 3 als Nutzer mit Schreibrechten hinzufügen (damit der Server Karten anlegen darf).

## 5. JSON base64-kodieren
- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Pfad\zu\wallet-signer-xxxx.json"))
  ```
  Die ausgegebene lange Zeichenkette ist `GOOGLE_WALLET_SA_JSON_B64`.

## 6. Variablen eintragen
- **Lokal:** in `.env`:
  ```
  GOOGLE_WALLET_ISSUER_ID=3388000000022222222
  GOOGLE_WALLET_SA_JSON_B64=<lange-base64-zeichenkette>
  ```
- **Vercel:** Projekt → Settings → Environment Variables → beide Werte für **Production** anlegen.
- Danach neu deployen: `npx vercel --prod --yes` und `npx vercel promote <neue-url> --yes`.

## 7. Test
- Android-Handy: QR einer Aktion scannen → „In Google Wallet speichern" → ein Tipp → Karte ist drin.
- Im Laden stempeln → die Karte aktualisiert sich automatisch (3/10 → 4/10).
```

- [ ] **Step 3: Commit**

```bash
git add GOOGLE-WALLET-SETUP.md .env.example
git commit -m "docs(google): step-by-step Google Wallet setup guide"
```

---

### Task 10: Deploy + Live-Verifikation (Apple-Regress + Google-Readiness)

**Files:**
- Reference only (Deploy aus dem Ordner).

**Interfaces:**
- Consumes: alle vorigen Tasks.

- [ ] **Step 1: Alle Offline-Tests grün**

Run:
```bash
node scripts/test-mint.mjs && node scripts/test-google-jwt.mjs && node scripts/test-googleview.mjs && node scripts/test-hero-fit.mjs && node scripts/test-wallet-target.mjs
```
Expected: fünf `… OK`-Zeilen.

- [ ] **Step 2: Deploy + promote**

```bash
npx vercel --prod --yes
npx vercel promote <ausgegebene-deploy-url> --yes
```

- [ ] **Step 3: Apple-Pfad nicht regressiert (Demo-Pass)**

Run:
```bash
curl -sI "https://qr-voucher-customer-app.vercel.app/api/pass?demo=stamp10" | grep -i "content-type"
```
Expected: `content-type: application/vnd.apple.pkpass`.

- [ ] **Step 4: Dispatcher erkennt OS**

Run:
```bash
curl -sI -A "iPhone" "https://qr-voucher-customer-app.vercel.app/api/card?demo=stamp10" -o /dev/null -w "%{http_code} %{redirect_url}\n"
curl -s  -A "Android" "https://qr-voucher-customer-app.vercel.app/api/card?campaign=<echte-id>" | grep -o "Google Wallet kommt in Kürze\|In Google Wallet speichern"
```
Expected: iPhone → `302 …/api/pass?...`. Android → einer der beiden Texte (je nachdem, ob Google-Env schon gesetzt ist).

- [ ] **Step 5: Hero-Bild liefert 3:1 (sobald eine echte Kampagne existiert)**

Run:
```bash
curl -s "https://qr-voucher-customer-app.vercel.app/api/card-image?campaign=<echte-id>&format=hero" -o hero.png && node -e "import('sharp').then(async s=>{const m=await s.default('hero.png').metadata();console.log(m.width+'x'+m.height)})"
```
Expected: `2064x688`.

- [ ] **Step 6 (GATED — erst wenn `GOOGLE_WALLET_*`-Env gesetzt): Live-Android-Test**

Voraussetzung: Issuer-ID + SA-JSON in Vercel gesetzt + Dienstkonto in der Wallet Console berechtigt. Dann:
1. Echtes Android-Handy: QR einer Aktion scannen → „In Google Wallet speichern" → Karte erscheint mit korrekter Farbe/Logo/Hero/Feldern/QR.
2. Im Dashboard die Karte stempeln → Karte im Handy aktualisiert sich automatisch (Textzeile `3/10 → 4/10`).
3. Bei Fehlern: `npx vercel logs <url>` → 4xx/5xx aus `card dispatch`/`gwallet patch` prüfen (häufig: Dienstkonto fehlt Wallet-Console-Zugriff, oder Issuer-ID falsch).

- [ ] **Step 7: Abschluss-Commit (falls noch ungetrackte Hilfsdateien)**

```bash
git add -A && git commit -m "chore(google): Google Wallet integration ready (gated on issuer credentials)" || echo "nichts zu committen"
```

---

## Self-Review

**Spec-Coverage:** Geräte-Erkennung+Dispatch (Task 6) ✓; GenericObject visuell wie Apple via cardView (Task 4) ✓; Hero = User-Design 3:1 (Task 5) ✓; Stempelzahl als Live-Textfeld (Task 4 `fieldRows` + Task 7 Patch) ✓; Live-Update-Parität (Task 7) ✓; Save-JWT RS256 dependency-frei (Task 3) ✓; geteilte Mint + Drossel (Task 2) ✓; `google_object_id` (Task 1) ✓; QR-Umstellung (Task 8) ✓; Setup-Guide + Env (Task 9) ✓; env-gated/kein Crash ohne Creds (Task 3 `googleConfigured`, Task 6 Platzhalter, Task 7 no-op) ✓; Apple unangetastet (Task 2 Step 6 + Task 10 Step 3) ✓.

**Platzhalter:** `<echte-id>`, `<deploy-url>`, `<lange-base64-zeichenkette>` sind bewusste Laufzeit-Eingaben (keine Code-Platzhalter). Live-Google-Schritte sind explizit GATED auf Credentials — kein verstecktes TODO.

**Typ-Konsistenz:** `mintCard`→`{camp,biz,theme,slug,serial,remaining,...}` von Task 6 genau so konsumiert. `buildGoogleCard({camp,pass,theme,slug,serial,org,heroUrl,logoUrl})→{classObj,object,oid}` konsistent Task 4↔6. `googlePatchFor(...)→{textModulesData,heroImage?}` Task 4↔7. `saveLink({id,classId})`/`ensureClass`/`upsertObject`/`patchObject`/`googleConfigured` Namen identisch Task 3↔6↔7. `walletTarget` Rückgabe `'apple'|'android'|'other'` Task 6 durchgehend.

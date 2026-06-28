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

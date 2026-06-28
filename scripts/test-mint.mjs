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

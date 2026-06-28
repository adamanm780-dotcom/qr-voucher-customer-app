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

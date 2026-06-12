const BASE = 'https://qr-voucher-customer-app.vercel.app/api/redeem';
const S = 'LILA-014F00';
async function call(redeemReward = false) {
  const r = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial: S, redeemReward }) });
  return r.json();
}
// 0 -> 9
let last;
for (let i = 0; i < 9; i++) { last = await call(); await new Promise(r=>setTimeout(r,400)); }
console.log('nach 9 Stempeln:', last.action, '|', last.message, '| stamps=' + last.pass.stamps);
// 10. Stempel -> sollte reward_ready sein, KEIN reset
const tenth = await call();
console.log('10. Stempel    :', tenth.action, '|', tenth.message, '| stamps=' + tenth.pass.stamps + ' status=' + tenth.pass.status);
// erneuter Scan ohne Flag -> wieder Angebot (kein 11. Stempel)
const again = await call();
console.log('erneuter Scan  :', again.action, '|', again.message, '| stamps=' + again.pass.stamps);
// Belohnung einlösen -> reset auf 0
const redeemed = await call(true);
console.log('einlösen       :', redeemed.action, '|', redeemed.message, '| stamps=' + redeemed.pass.stamps + ' status=' + redeemed.pass.status);
// wieder auf 9 fuer den Live-Test des Users
for (let i = 0; i < 9; i++) { last = await call(); await new Promise(r=>setTimeout(r,400)); }
console.log('zurueck auf    :', last.pass.stamps + '/' + last.pass.goal, '(bereit fuer Live-Scan #10)');

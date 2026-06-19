// End-to-End-Test der neuen Mechaniken gegen die LIVE-API.
// Legt Test-Aktionen bei einem Test-Betrieb an, mintet Pässe, scannt sie als Betrieb,
// prüft multipass/balance/access und räumt danach alles wieder weg.
//   node scripts/test-mechanics.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const APP = 'https://qr-voucher-customer-app.vercel.app';
const svc = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pub = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗ FEHLER'}  ${name}${extra ? ' — ' + extra : ''}`); };
const tok = () => Math.random().toString(16).slice(2, 18);

// 1) Admin-Login -> Admin-JWT -> Nordsee impersonieren -> Betriebs-JWT
const { data: adminAuth, error: aerr } = await pub.auth.signInWithPassword({ email: 'admin@flowstate.app', password: 'Flowstate2026' });
if (aerr) { console.error('Admin-Login fehlgeschlagen:', aerr.message); process.exit(1); }
const adminJwt = adminAuth.session.access_token;

const { data: biz } = await svc.from('businesses').select('id,name').ilike('name', '%nordsee%').limit(1).maybeSingle();
if (!biz) { console.error('Test-Betrieb (Nordsee) nicht gefunden.'); process.exit(1); }
console.log('Test-Betrieb:', biz.name, '\n');

const imp = await fetch(`${APP}/api/admin/impersonate`, { method: 'POST', headers: { Authorization: 'Bearer ' + adminJwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id: biz.id }) }).then(r => r.json());
if (!imp.ok) { console.error('Impersonate fehlgeschlagen:', imp.message); process.exit(1); }
const bizJwt = imp.access_token;

const redeem = (serial, body = {}) => fetch(`${APP}/api/redeem`, { method: 'POST', headers: { Authorization: 'Bearer ' + bizJwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ serial, ...body }) }).then(r => r.json());

const createdCampaigns = [];
async function mkCampaign(row) {
  const { data, error } = await svc.from('campaigns').insert({ business_id: biz.id, active: true, enroll_token: tok(), ...row }).select().single();
  if (error) throw new Error('campaign insert: ' + error.message);
  createdCampaigns.push(data.id);
  return data;
}
async function mintPass(camp) {
  const r = await fetch(`${APP}/api/pass?enroll=${camp.enroll_token}`);
  if (r.status !== 200) throw new Error('pass mint status ' + r.status);
  const { data: p } = await svc.from('passes').select('serial,remaining,status').eq('campaign_id', camp.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return p;
}

try {
  // ---- MULTIPASS: 2 Einlösungen ----
  console.log('— Mehrfachkarte (max_uses 2) —');
  const mp = await mkCampaign({ type: 'multipass', title: 'TEST 2er-Karte', reward: '1 Test', config: { max_uses: 2 } });
  const mpPass = await mintPass(mp);
  ok('mint: remaining=2', Number(mpPass.remaining) === 2, 'remaining=' + mpPass.remaining);
  let r1 = await redeem(mpPass.serial);
  ok('1. use -> 1 übrig', r1.ok && r1.action === 'use' && r1.pass.remaining === 1, JSON.stringify(r1.pass));
  let r2 = await redeem(mpPass.serial);
  ok('2. use -> 0 übrig + depleted', r2.ok && r2.pass.remaining === 0 && r2.pass.status === 'depleted', JSON.stringify(r2.pass));
  let r3 = await redeem(mpPass.serial);
  ok('3. use -> abgelehnt (depleted)', !r3.ok && r3.action === 'depleted', r3.action);

  // ---- BALANCE: 10 € ----
  console.log('\n— Guthaben (10 €) —');
  const bal = await mkCampaign({ type: 'balance', title: 'TEST Guthaben', config: { start_amount: 10, unit: '€' } });
  const balPass = await mintPass(bal);
  ok('mint: remaining=10', Number(balPass.remaining) === 10, 'remaining=' + balPass.remaining);
  let b0 = await redeem(balPass.serial);
  ok('ohne Betrag -> need_amount', !b0.ok && b0.action === 'need_amount', b0.action);
  let b1 = await redeem(balPass.serial, { amount: 4 });
  ok('abbuchen 4 -> 6 übrig', b1.ok && b1.action === 'debit' && b1.pass.remaining === 6, JSON.stringify(b1.pass));
  let b2 = await redeem(balPass.serial, { amount: 100 });
  ok('abbuchen 100 -> insufficient', !b2.ok && b2.action === 'insufficient', b2.action);
  let b3 = await redeem(balPass.serial, { amount: 6 });
  ok('abbuchen 6 -> 0 + depleted', b3.ok && b3.pass.remaining === 0 && b3.pass.status === 'depleted', JSON.stringify(b3.pass));

  // ---- ACCESS: einmaliger Zutritt ----
  console.log('\n— Zugangspass (einmalig) —');
  const acc = await mkCampaign({ type: 'access', title: 'TEST Zutritt', config: { repeat: false } });
  const accPass = await mintPass(acc);
  let a1 = await redeem(accPass.serial);
  ok('1. entry -> ok', a1.ok && a1.action === 'entry', a1.action);
  let a2 = await redeem(accPass.serial);
  ok('2. entry -> already', !a2.ok && a2.action === 'already', a2.action);

  // ---- ACCESS: abgelaufen ----
  console.log('\n— Zugangspass (abgelaufen) —');
  const accX = await mkCampaign({ type: 'access', title: 'TEST Abgelaufen', config: { repeat: false, valid_until: '2020-01-01' } });
  const accXPass = await mintPass(accX);
  let x1 = await redeem(accXPass.serial);
  ok('entry abgelaufen -> expired', !x1.ok && x1.action === 'expired', x1.action);

} catch (e) {
  console.error('\nTEST-ABBRUCH:', e.message);
  fail++;
} finally {
  // Cleanup: Pässe (+ redemptions) und Kampagnen wieder löschen
  if (createdCampaigns.length) {
    const { data: ps } = await svc.from('passes').select('id').in('campaign_id', createdCampaigns);
    const pids = (ps || []).map(p => p.id);
    if (pids.length) await svc.from('redemptions').delete().in('pass_id', pids);
    await svc.from('passes').delete().in('campaign_id', createdCampaigns);
    await svc.from('campaigns').delete().in('id', createdCampaigns);
    console.log(`\nAufgeräumt: ${createdCampaigns.length} Test-Aktionen + ${pids.length} Test-Pässe gelöscht.`);
  }
  console.log(`\n==== ${pass} OK, ${fail} Fehler ====`);
  process.exit(fail ? 1 : 0);
}

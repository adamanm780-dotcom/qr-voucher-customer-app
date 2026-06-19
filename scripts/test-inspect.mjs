// Test des INSPECT-Modus (Scanner-Vorschau) gegen die LIVE-API.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const APP = 'https://qr-voucher-customer-app.vercel.app';
const svc = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pub = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { (c ? pass++ : fail++); console.log(`${c ? '✓' : '✗ FEHLER'}  ${n}${x ? ' — ' + x : ''}`); };
const tok = () => Math.random().toString(16).slice(2, 18);

const { data: adminAuth } = await pub.auth.signInWithPassword({ email: 'admin@flowstate.app', password: 'Flowstate2026' });
const adminJwt = adminAuth.session.access_token;
const { data: biz } = await svc.from('businesses').select('id,name').ilike('name', '%nordsee%').limit(1).maybeSingle();
const imp = await fetch(`${APP}/api/admin/impersonate`, { method: 'POST', headers: { Authorization: 'Bearer ' + adminJwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id: biz.id }) }).then(r => r.json());
const bizJwt = imp.access_token;
const call = (body) => fetch(`${APP}/api/redeem`, { method: 'POST', headers: { Authorization: 'Bearer ' + bizJwt, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

const created = [];
async function mk(row) { const { data } = await svc.from('campaigns').insert({ business_id: biz.id, active: true, enroll_token: tok(), ...row }).select().single(); created.push(data.id); return data; }
async function mint(c) { await fetch(`${APP}/api/pass?enroll=${c.enroll_token}`); const { data: p } = await svc.from('passes').select('serial').eq('campaign_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(); return p.serial; }

try {
  // multipass: inspect zeigt Label/Rest, mutiert NICHT
  const mp = await mk({ type: 'multipass', title: 'INSPECT mp', config: { max_uses: 3 } });
  const mpS = await mint(mp);
  const i1 = await call({ serial: mpS, inspect: true });
  ok('multipass inspect ok+label', i1.ok && i1.inspect && i1.card.label === 'Mehrfachkarte', i1.card?.label);
  ok('multipass remaining=3 usable', i1.card.remaining === 3 && i1.card.usable === true, 'rem=' + i1.card?.remaining);
  ok('multipass action=use', i1.card.action === 'use', i1.card?.action);
  const { data: after } = await svc.from('passes').select('remaining').eq('serial', mpS).maybeSingle();
  ok('inspect mutiert NICHT (remaining bleibt 3)', Number(after.remaining) === 3, 'rem=' + after?.remaining);

  // balance: needsAmount
  const bal = await mk({ type: 'balance', title: 'INSPECT bal', config: { start_amount: 25, unit: '€' } });
  const balS = await mint(bal);
  const i2 = await call({ serial: balS, inspect: true });
  ok('balance needsAmount=true', i2.card.needsAmount === true && i2.card.remaining === 25, JSON.stringify({ n: i2.card?.needsAmount, r: i2.card?.remaining }));

  // depleted multipass -> usable=false
  const mp0 = await mk({ type: 'multipass', title: 'INSPECT leer', config: { max_uses: 1 } });
  const mp0S = await mint(mp0);
  await call({ serial: mp0S });            // 1× nutzen -> erschöpft
  const i3 = await call({ serial: mp0S, inspect: true });
  ok('erschöpfte Karte: usable=false + reason', i3.card.usable === false && /aufgebraucht/i.test(i3.card.reason || ''), i3.card?.reason);
} catch (e) { console.error('ABBRUCH:', e.message); fail++; }
finally {
  if (created.length) {
    const { data: ps } = await svc.from('passes').select('id').in('campaign_id', created);
    const pids = (ps || []).map(p => p.id);
    if (pids.length) await svc.from('redemptions').delete().in('pass_id', pids);
    await svc.from('passes').delete().in('campaign_id', created);
    await svc.from('campaigns').delete().in('id', created);
    console.log(`\nAufgeräumt: ${created.length} Aktionen, ${pids.length} Pässe.`);
  }
  console.log(`\n==== ${pass} OK, ${fail} Fehler ====`);
  process.exit(fail ? 1 : 0);
}

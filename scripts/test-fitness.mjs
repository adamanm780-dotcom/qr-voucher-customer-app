// E2E Fitness First Zeit-Pass (Start ab ERSTEM Scan): leer -> 1. Scan Tag1 -> Tage wachsen -> Ablauf.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const APP = 'https://qr-voucher-customer-app.vercel.app';
const svc = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const pub = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0; const ok = (n, c, x = '') => { (c ? pass++ : fail++); console.log(`${c ? '✓' : '✗ FEHLER'}  ${n}${x ? ' — ' + x : ''}`); };
const T7 = '2c31e0004a432', C7 = '71e2a8bd-f3d9-4bc1-97d2-407368048383';

const { data: adminAuth } = await pub.auth.signInWithPassword({ email: 'admin@flowstate.app', password: 'Flowstate2026' });
const { data: biz } = await svc.from('businesses').select('id').eq('slug', 'fitness-first-wiesbaden').single();
const imp = await fetch(`${APP}/api/admin/impersonate`, { method: 'POST', headers: { Authorization: 'Bearer ' + adminAuth.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id: biz.id }) }).then(r => r.json());
const jwt = imp.access_token;
const rd = (b) => fetch(`${APP}/api/redeem`, { method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const backdateEntry = (pid, daysAgo) => svc.from('redemptions').update({ created_at: new Date(Date.now() - daysAgo * 86400000).toISOString() }).eq('pass_id', pid).eq('action', 'entry');

let pid = null;
try {
  await fetch(`${APP}/api/pass?enroll=${T7}`);
  const { data: p } = await svc.from('passes').select('id,serial').eq('campaign_id', C7).order('created_at', { ascending: false }).limit(1).maybeSingle();
  pid = p.id; const s = p.serial;

  let i = await rd({ serial: s, inspect: true });
  ok('frisch ausgegeben -> LEER, "startet mit 1. Scan"', i.card.usable && /Startet mit 1\. Scan/.test(i.card.dayInfo || ''), i.card.dayInfo);

  const e = await rd({ serial: s });
  ok('1. Scan -> Tag 1/7', e.ok && /Tag 1\/7/.test(e.message || ''), e.message);

  i = await rd({ serial: s, inspect: true });
  ok('inspect: Tag 1/7 + gültig bis', /Tag 1\/7/.test(i.card.dayInfo || '') && !!i.card.validUntil, `${i.card.dayInfo} / ${i.card.validUntil}`);

  await backdateEntry(pid, 2);   // erster Scan vor 2 Tagen -> Tag 3
  i = await rd({ serial: s, inspect: true });
  ok('1. Scan vor 2 Tagen -> Tag 3/7', /Tag 3\/7/.test(i.card.dayInfo || ''), i.card.dayInfo);

  await backdateEntry(pid, 8);   // vor 8 Tagen -> abgelaufen
  i = await rd({ serial: s, inspect: true });
  ok('1. Scan vor 8 Tagen -> abgelaufen', !i.card.usable && /abgelaufen/i.test(i.card.reason || ''), i.card.reason);
} catch (e) { console.error('ABBRUCH:', e.message); fail++; }
finally {
  if (pid) { await svc.from('redemptions').delete().eq('pass_id', pid); await svc.from('passes').delete().eq('id', pid); console.log('\nAufgeräumt.'); }
  console.log(`\n==== ${pass} OK, ${fail} Fehler ====`);
  process.exit(fail ? 1 : 0);
}

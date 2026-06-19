// Misst, wo die Zeit beim Dashboard-Öffnen verloren geht.
// 1) Tabellengrößen (Service-Key), 2) Dashboard-Queries unter RLS (als Lila),
// 3) Impersonate-Flow serverseitig (Magic-Link erzeugen + einlösen).
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const svc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const t = async (label, fn) => {
  const s = Date.now();
  try { const r = await fn(); console.log(label.padEnd(46), (Date.now() - s) + 'ms', r !== undefined ? `(${r})` : ''); }
  catch (e) { console.log(label.padEnd(46), (Date.now() - s) + 'ms', 'FEHLER: ' + e.message); }
};

console.log('— Tabellengrößen (gesamt, Service-Key) —');
for (const tbl of ['businesses', 'campaigns', 'passes', 'redemptions', 'device_registrations']) {
  const { count, error } = await svc.from(tbl).select('*', { count: 'exact', head: true });
  console.log(tbl.padEnd(24), error ? 'ERR ' + error.message : count + ' Zeilen');
}

console.log('\n— Login als Lila + Dashboard-Queries (mit RLS) —');
let lila;
await t('signInWithPassword (lila)', async () => {
  const { data, error } = await anon.auth.signInWithPassword({ email: 'lila@flowstate.app', password: 'Lila2026Test' });
  if (error) throw error; lila = data.session; return 'ok';
});
const asLila = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false }, global: { headers: { Authorization: 'Bearer ' + lila.access_token } },
});
await t('select businesses (RLS)', async () => {
  const { data, error } = await asLila.from('businesses').select('id,name,slug,logo_url,color_bg,color_text');
  if (error) throw error; return data.length + ' rows';
});
await t('count passes active (RLS, ohne biz-Filter)', async () => {
  const { count, error } = await asLila.from('passes').select('*', { count: 'exact', head: true }).eq('status', 'active');
  if (error) throw error; return count;
});
await t('count redemptions redeem+ilike (RLS)', async () => {
  const { count, error } = await asLila.from('redemptions').select('*', { count: 'exact', head: true }).eq('action', 'redeem').ilike('note', 'Belohnung:%');
  if (error) throw error; return count;
});
await t('count campaigns active (RLS)', async () => {
  const { count, error } = await asLila.from('campaigns').select('*', { count: 'exact', head: true }).eq('active', true);
  if (error) throw error; return count;
});
await t('select campaigns list (RLS)', async () => {
  const { data, error } = await asLila.from('campaigns').select('id,type,title,value,stamp_goal,reward,enroll_token,created_at').order('created_at', { ascending: false });
  if (error) throw error; return data.length + ' rows';
});

console.log('\n— Impersonate-Flow (serverseitig, wie /api/admin/impersonate) —');
await t('generateLink magiclink', async () => {
  const { data, error } = await svc.auth.admin.generateLink({ type: 'magiclink', email: 'lila@flowstate.app' });
  if (error) throw error;
  const s = Date.now();
  const r = await fetch(data.properties.action_link, { redirect: 'manual' });
  console.log('  fetch action_link (einlösen)'.padEnd(46), (Date.now() - s) + 'ms', '(status ' + r.status + ')');
  return 'ok';
});

console.log('\n— Cockpit: GET businesses gesamt (wie api, parallelisiert) —');
await t('businesses + counts parallel', async () => {
  const { data: bizs } = await svc.from('businesses').select('id,owner_id');
  await Promise.all((bizs || []).map(b => Promise.all([
    svc.from('passes').select('*', { count: 'exact', head: true }).eq('business_id', b.id).eq('status', 'active'),
    svc.from('campaigns').select('*', { count: 'exact', head: true }).eq('business_id', b.id).eq('active', true),
  ])));
  return (bizs || []).length + ' Betriebe';
});
process.exit(0);

// Testet die Anmeldung exakt so wie der Browser: mit dem PUBLISHABLE key.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const PUBLISHABLE = 'sb_publishable_vmm6yHGzsKCteylEfJr6qw_WvkKM_RD';
const s = createClient(process.env.SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });

const { data: login, error: loginErr } = await s.auth.signInWithPassword({
  email: 'lila@flowstate.app',
  password: 'Lila2026Test',
});
if (loginErr) { console.log('LOGIN_FAILED:', loginErr.message); process.exit(1); }
console.log('LOGIN_OK: eingeloggt als', login.user.email);

const { data: biz, error: bizErr } = await s.from('businesses').select('name,slug,color_bg');
if (bizErr) { console.log('RLS_READ_FAILED:', bizErr.message); process.exit(1); }
console.log('SEES_OWN_BUSINESS:', biz.length, 'Betrieb(e) ->', biz.map(b => b.name).join(', '));
console.log('ALL_GOOD');

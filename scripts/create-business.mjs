// FlowState — neuen Betrieb (Kunde) anlegen.
// Erzeugt: Auth-Login (E-Mail+Passwort) + businesses-Eintrag, verknüpft via owner_id.
// So legt FlowState jeden neuen Kunden an.
//
// Aufruf:
//   node scripts/create-business.mjs "<name>" "<slug>" "<email>" "<passwort>" [bgFarbe] [textFarbe]
// Beispiel:
//   node scripts/create-business.mjs "Lila Wiesbaden" "lila-wiesbaden" "lila@flowstate.app" "GeheimesPW123" "#4c2882" "#ffffff"

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [, , name, slug, email, password, bg = '#4c2882', text = '#ffffff'] = process.argv;

if (!name || !slug || !email || !password) {
  console.error('❌ Aufruf: node scripts/create-business.mjs "<name>" "<slug>" "<email>" "<passwort>" [bg] [text]');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. Auth-User anlegen (E-Mail direkt bestätigt, kein Bestätigungs-Mail nötig)
const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (userErr) {
  console.error('❌ Konnte Login nicht anlegen:', userErr.message);
  process.exit(1);
}
const userId = userData.user.id;
console.log('✅ Login angelegt:', email, '(user id:', userId + ')');

// 2. businesses-Eintrag anlegen, verknüpft mit dem Login
const { data: bizData, error: bizErr } = await supabase
  .from('businesses')
  .insert({ owner_id: userId, name, slug, color_bg: bg, color_text: text })
  .select()
  .single();
if (bizErr) {
  console.error('❌ Konnte Betrieb nicht anlegen:', bizErr.message);
  // Aufräumen: Auth-User wieder löschen, damit nichts halb übrig bleibt
  await supabase.auth.admin.deleteUser(userId);
  console.error('   (Login wieder entfernt, damit nichts halb angelegt bleibt.)');
  process.exit(1);
}

console.log('✅ Betrieb angelegt:', bizData.name, '(business id:', bizData.id + ')');
console.log('\n🎉 Fertig! Login-Daten:');
console.log('   E-Mail:   ', email);
console.log('   Passwort: ', password);
console.log('   Branding: ', bg, '/', text);

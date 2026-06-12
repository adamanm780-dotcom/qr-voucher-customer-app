// Versucht, das Push-Schema via Supabase auszuführen.
// Supabase JS kann kein rohes DDL -> wir prüfen nur ob die Tabelle existiert.
// Falls nicht: User muss db/push-schema.sql im SQL-Editor ausführen.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { error } = await s.from('device_registrations').select('id', { count: 'exact', head: true });
if (error && error.message.includes('does not exist')) {
  console.log('NICHT_DA: device_registrations existiert noch nicht -> SQL im Editor ausführen.');
} else if (error) {
  console.log('FEHLER:', error.message);
} else {
  console.log('OK: device_registrations existiert bereits.');
}

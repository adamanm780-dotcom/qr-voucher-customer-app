// Entfernt Test-Kampagnen (alles was beim Entwickeln angelegt wurde).
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} });

const { data: before } = await s.from('campaigns').select('id,title');
console.log('Vorher:', before?.length ?? 0, 'Kampagnen');
const { error } = await s.from('campaigns').delete().neq('id','00000000-0000-0000-0000-000000000000');
if (error) { console.error('Fehler:', error.message); process.exit(1); }
const { data: after } = await s.from('campaigns').select('id');
console.log('Nachher:', after?.length ?? 0, 'Kampagnen — Test-Daten entfernt ✓');

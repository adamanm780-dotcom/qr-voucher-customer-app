import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data, error } = await s.from('campaigns').select('id,type,title,value,stamp_goal,reward,enroll_token').order('created_at',{ascending:false});
if (error) { console.error(error.message); process.exit(1); }
console.log('Kampagnen:', data.length);
for (const c of data) console.log(`  ${c.type.padEnd(9)} | ${c.id} | ${c.title} | goal=${c.stamp_goal||'-'} | token=${c.enroll_token||'-'}`);

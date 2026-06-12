import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const LOGO = 'https://qr-voucher-customer-app.vercel.app/assets/lila-logo.png';
const { data, error } = await s.from('businesses').update({ logo_url: LOGO }).eq('slug','lila-wiesbaden').select('name,logo_url');
if (error) { console.error(error.message); process.exit(1); }
console.log('Logo gesetzt fuer:', JSON.stringify(data));

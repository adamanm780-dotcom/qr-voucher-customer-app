// Schneller Verbindungstest: kann der Server mit Supabase reden + Tabellen sehen?
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error('❌ SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt in .env');
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

const tables = ['businesses', 'campaigns', 'passes', 'redemptions'];
let allOk = true;

for (const t of tables) {
  const { error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`❌ ${t}: ${error.message}`);
    allOk = false;
  } else {
    console.log(`✅ ${t}: erreichbar (${count ?? 0} Zeilen)`);
  }
}

console.log(allOk ? '\n🎉 Datenbank-Verbindung steht — alle Tabellen da!' : '\n⚠️ Es gab Probleme.');
process.exit(allOk ? 0 : 1);

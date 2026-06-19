// Introspektion: Spalten von businesses/campaigns/passes + vorkommende type/status/action-Werte.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} });
for (const t of ['businesses','campaigns','passes','redemptions']) {
  const { data, error } = await db.from(t).select('*').limit(1);
  console.log(`\n== ${t} ==`);
  if (error) { console.log('  FEHLER:', error.message); continue; }
  console.log('  Spalten:', data?.[0] ? Object.keys(data[0]).join(', ') : '(keine Zeile)');
}
const { data: camps } = await db.from('campaigns').select('type').limit(5000);
console.log('\ncampaigns.type Werte:', [...new Set((camps||[]).map(c=>c.type))].join(', '));
const { data: pst } = await db.from('passes').select('status').limit(20000);
console.log('passes.status Werte:', [...new Set((pst||[]).map(p=>p.status))].join(', '));
const { data: ra } = await db.from('redemptions').select('action').limit(20000);
console.log('redemptions.action Werte:', [...new Set((ra||[]).map(r=>r.action))].join(', '));

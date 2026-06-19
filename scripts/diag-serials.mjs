// Diagnose: pro Betrieb die Serial-Präfixe der existierenden Pässe vs. erwarteter Präfix.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth:{persistSession:false} });
const { data: bizs } = await db.from('businesses').select('id,name,slug');
const byId = new Map(bizs.map(b=>[b.id,b]));
const { data: passes } = await db.from('passes').select('serial,business_id').limit(20000);
const m = new Map();
for (const p of passes||[]) {
  const pre = (p.serial||'').split('-')[0] || '(leer)';
  if(!m.has(p.business_id)) m.set(p.business_id,new Map());
  const pm=m.get(p.business_id); pm.set(pre,(pm.get(pre)||0)+1);
}
const rows=[];
for (const [bid,pm] of m){
  const b=byId.get(bid); const slug=b?.slug||'??';
  const expected=(slug||'').replace(/[^a-z0-9]/gi,'').slice(0,4).toUpperCase()||'FS';
  const prefixes=[...pm.entries()].map(([k,v])=>`${k}:${v}`).join(', ');
  const ok=[...pm.keys()].every(k=>k===expected);
  rows.push({name:b?.name||'?',slug,expected,prefixes,ok});
}
rows.sort((a,b)=>Number(a.ok)-Number(b.ok));
for(const r of rows) console.log(`${r.ok?'OK ':'!! '} ${r.name.slice(0,22).padEnd(22)} slug=${r.slug.padEnd(24)} erwartet=${r.expected.padEnd(5)} hat[ ${r.prefixes} ]`);

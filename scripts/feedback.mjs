// Offene Verbesserungs-Notizen (vom User im Cockpit hinterlassen) anzeigen.
//   node scripts/feedback.mjs            -> listet offene Notizen
//   node scripts/feedback.mjs done <id>  -> erledigt (Notiz entfernen)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const B = 'design-uploads';

const [cmd, fid] = process.argv.slice(2);
if (cmd === 'done' && fid) {
  await db.storage.from(B).remove([`feedback/${fid}.json`]);
  console.log('Erledigt:', fid);
  process.exit(0);
}
const { data: files } = await db.storage.from(B).list('feedback', { limit: 200 });
const recs = [];
for (const f of (files || []).filter(x => x.name.endsWith('.json'))) {
  const { data } = await db.storage.from(B).download(`feedback/${f.name}`);
  if (data) { try { recs.push(JSON.parse(await data.text())); } catch {} }
}
recs.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
if (!recs.length) { console.log('Keine offenen Notizen.'); process.exit(0); }
console.log(`${recs.length} offene Notiz(en):\n`);
for (const r of recs) console.log(`• [${r.id}] ${r.business_name || '(allg.)'}: ${r.note}\n   ${r.ts}`);
console.log('\nErledigt markieren: node scripts/feedback.mjs done <id>');

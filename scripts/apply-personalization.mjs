// Liest das Workflow-Ergebnis (Recherche-Vorlagen) und schreibt businesses.templates pro Betrieb (Abgleich via slug).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const OUT = process.argv[2] || 'C:/Users/maykt/AppData/Local/Temp/claude/C--Users-maykt/197fa8ce-6722-4bee-bff6-3eaca6d8e65c/tasks/wddhqypdy.output';
const raw = readFileSync(OUT, 'utf8');
const parsed = JSON.parse(raw);
const results = Array.isArray(parsed) ? parsed : (parsed.result || []);

// Workflow-Format -> Dashboard-Vorlagenformat
function toTemplate(t) {
  if (!t || !t.label || !t.mech) return null;
  if (t.mech === 'stampcard') {
    return { label: t.label, sub: t.sub || '', mech: 'stampcard', fill: { goalSeg: t.goal === 5 ? 5 : 10, sReward: t.reward || '1 Gratis-Produkt' } };
  }
  return { label: t.label, sub: t.sub || '', mech: 'coupon', create: { type: 'coupon', title: t.title || t.label, value: t.value || '' } };
}

let ok = 0, skip = 0;
for (const r of results) {
  if (!r || !r.slug || !Array.isArray(r.templates)) { skip++; continue; }
  const templates = r.templates.map(toTemplate).filter(Boolean);
  if (!templates.length) { console.log('LEER, übersprungen:', r.slug); skip++; continue; }
  const { error } = await db.from('businesses').update({ templates }).eq('slug', r.slug);
  if (error) { console.log('FEHLER ' + r.slug + ': ' + error.message); skip++; }
  else { ok++; console.log(`OK  ${r.name.padEnd(22)} [${(r.cuisine || '').slice(0, 24).padEnd(24)}] ${templates.length} Vorlagen ${r.found ? '(web)' : '(abgeleitet)'}`); }
}
console.log(`\n==== ${ok} Betriebe personalisiert, ${skip} übersprungen ====`);

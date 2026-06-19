// Korrigiert Serial-Präfixe bestehender Pässe: LILA-XXXX -> <SLUGPREFIX>-XXXX.
// Suffix bleibt erhalten (Stempel/Historie unberührt). Lila Wiesbaden wird NIE angefasst.
// device_registrations.pass_serial wird mitgezogen (DB-Konsistenz).
//
//   Dry-Run:   node scripts/fix-serials.mjs
//   Anwenden:  APPLY=1 node scripts/fix-serials.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const APPLY = !!process.env.APPLY;

const prefixOf = slug => (slug || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FS';

const { data: bizs } = await db.from('businesses').select('id,name,slug');
const byId = new Map(bizs.map(b => [b.id, b]));
const { data: passes } = await db.from('passes').select('id,serial,business_id').limit(20000);
const existing = new Set((passes || []).map(p => p.serial));

const rand = () => Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');

const plan = [];
for (const p of passes || []) {
  const b = byId.get(p.business_id);
  if (!b || b.slug === 'lila-wiesbaden') continue;          // Lila nie anfassen
  const exp = prefixOf(b.slug);
  const cur = (p.serial || '').split('-')[0];
  if (cur === exp) continue;                                 // schon korrekt
  const suffix = (p.serial || '').split('-').slice(1).join('-') || rand();
  let next = `${exp}-${suffix}`;
  while (existing.has(next)) next = `${exp}-${rand()}`;       // Kollision vermeiden
  existing.delete(p.serial); existing.add(next);
  plan.push({ id: p.id, biz: b.name, from: p.serial, to: next });
}

if (!plan.length) { console.log('Nichts zu korrigieren — alle Serials passen zum Betrieb.'); process.exit(0); }
console.log(`${plan.length} Serial(s) ${APPLY ? 'werden umbenannt' : '(Dry-Run, NICHTS geändert)'}:\n`);
for (const c of plan) console.log(`  ${c.biz.slice(0, 20).padEnd(20)} ${c.from.padEnd(16)} -> ${c.to}`);

if (!APPLY) { console.log('\n→ Zum Anwenden: APPLY=1 node scripts/fix-serials.mjs'); process.exit(0); }

let ok = 0, fail = 0;
for (const c of plan) {
  const r1 = await db.from('passes').update({ serial: c.to }).eq('id', c.id);
  if (r1.error) { console.error(`  FEHLER ${c.from}: ${r1.error.message}`); fail++; continue; }
  await db.from('device_registrations').update({ pass_serial: c.to }).eq('pass_serial', c.from);
  ok++;
}
console.log(`\nFertig: ${ok} umbenannt, ${fail} Fehler.`);

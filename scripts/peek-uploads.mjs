// Lädt offene Design-Uploads runter und erzeugt den fertigen Strip zum ANSCHAUEN
// (Claude liest ihn, bestimmt die Kreis-Positionen, schreibt _brand/<id>-pos.json).
// Provisioniert NICHTS. Danach: node scripts/build-uploads.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
mkdirSync('_brand', { recursive: true });
const { data: files } = await db.storage.from('design-uploads').list('pending', { limit: 100 });
const metas = (files || []).filter(f => f.name.endsWith('.json'));
if (!metas.length) { console.log('Keine offenen Uploads.'); process.exit(0); }
for (const mf of metas) {
  const id = mf.name.replace(/\.json$/, '');
  const { data: mj } = await db.storage.from('design-uploads').download(`pending/${id}.json`);
  const meta = JSON.parse(await mj.text());
  const { data: img } = await db.storage.from('design-uploads').download(`pending/${id}.png`);
  const buf = Buffer.from(await img.arrayBuffer());
  const out = `_peek-${id}.png`;
  await sharp(buf).resize(1125, 432, { fit: 'cover', position: 'centre' }).png().toFile(out);
  console.log(`UPLOAD ${id} | "${meta.name}" | ${meta.goal}er | Strip: ${out}`);
  if (meta.note) console.log(`   📝 Hinweis: ${meta.note}`);
}
console.log('\n-> Strips ansehen, dann pro id _brand/<id>-pos.json schreiben:');
console.log('   {"positions":[{"x":0.15,"y":0.63}, ...], "rfr":0.06}');
console.log('-> danach: node scripts/build-uploads.mjs');

// Einmal-Migration: lädt alle biz-* Design-Assets nach Supabase-Storage (Bucket card-assets)
// und schreibt api/_assets/manifest.json (Liste der vorhandenen biz-Ordner).
// Danach lädt der Code die biz-Designs zur Laufzeit aus Storage statt aus dem Code-Bündel.
//   node scripts/migrate-assets-to-storage.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const BUCKET = 'card-assets';
const ROOT = 'api/_assets';

const { data: buckets } = await db.storage.listBuckets();
if (!(buckets || []).some(b => b.name === BUCKET)) {
  const { error } = await db.storage.createBucket(BUCKET, { public: false });
  if (error && !/exist/i.test(error.message)) throw error;
  console.log('Bucket angelegt:', BUCKET);
} else console.log('Bucket vorhanden:', BUCKET);

const dirs = readdirSync(ROOT).filter(d => d.startsWith('biz-') && statSync(join(ROOT, d)).isDirectory());
const tasks = [];
for (const d of dirs) for (const f of readdirSync(join(ROOT, d))) {
  if (f.endsWith('.png')) tasks.push({ path: `${d}/${f}`, full: join(ROOT, d, f) });
}
console.log(`${dirs.length} Ordner, ${tasks.length} PNGs -> Storage`);

let done = 0, failed = 0, idx = 0;
const CONC = 8;
async function worker() {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    try {
      const buf = readFileSync(t.full);
      const { error } = await db.storage.from(BUCKET).upload(t.path, buf, { contentType: 'image/png', upsert: true });
      if (error) { failed++; if (failed <= 8) console.log('FAIL', t.path, error.message); } else done++;
    } catch (e) { failed++; }
    if ((done + failed) % 200 === 0) console.log(`  ${done + failed}/${tasks.length} (ok ${done}, fail ${failed})`);
  }
}
await Promise.all(Array.from({ length: CONC }, () => worker()));
console.log(`Upload fertig: ${done} ok, ${failed} Fehler.`);

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ storageBucket: BUCKET, dirs: dirs.sort() }));
console.log('manifest.json geschrieben:', dirs.length, 'Ordner.');

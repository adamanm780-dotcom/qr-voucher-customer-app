// Voll-Backup der Datenbank -> eine zeitgestempelte JSON-Datei (lokal + optional Storage).
// Läuft auf JEDEM Tier (auch Supabase Free), ohne Extra-Abhängigkeiten.
//   node scripts/backup.mjs            -> nur lokal nach backups/
//   node scripts/backup.mjs --upload   -> zusätzlich in Storage-Bucket "backups"
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Alle fachlichen Tabellen. Neue Tabelle? Hier ergänzen.
const TABLES = ['businesses', 'campaigns', 'passes', 'redemptions', 'device_registrations'];
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

async function dumpAll() {
  const out = { _meta: { created_at: new Date().toISOString(), tables: {} }, data: {} };
  for (const t of TABLES) {
    // seitenweise holen (Supabase liefert max ~1000/Query)
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select('*').range(from, from + 999);
      if (error) { console.error(`  ${t}: FEHLER ${error.message}`); break; }
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    out.data[t] = rows;
    out._meta.tables[t] = rows.length;
    console.log(`  ${t.padEnd(22)} ${rows.length} Zeilen`);
  }
  return out;
}

console.log(`\nBackup ${STAMP} …`);
const dump = await dumpAll();
const json = JSON.stringify(dump, null, 2);
mkdirSync('backups', { recursive: true });
const file = join('backups', `backup-${STAMP}.json`);
writeFileSync(file, json);
console.log(`\n✅ Lokal gespeichert: ${file}  (${(json.length / 1024).toFixed(0)} KB)`);

if (process.argv.includes('--upload')) {
  try {
    await db.storage.createBucket('backups', { public: false }).catch(() => {});
    const up = await db.storage.from('backups').upload(`backup-${STAMP}.json`, Buffer.from(json), { contentType: 'application/json', upsert: true });
    if (up.error) console.error('Storage-Upload-Fehler:', up.error.message);
    else console.log('☁️  Auch in Storage-Bucket "backups" gesichert.');
  } catch (e) { console.error('Upload übersprungen:', e.message); }
}
console.log('');

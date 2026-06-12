// Read-only Wächter: meldet neue Design-Uploads (baut/deployt NICHT selbst).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const seen = new Set();
for (;;) {
  try {
    const { data: files } = await db.storage.from('design-uploads').list('pending', { limit: 100 });
    for (const f of (files || []).filter(x => x.name.endsWith('.json'))) {
      const id = f.name.replace(/\.json$/, '');
      if (!seen.has('u:' + id)) { seen.add('u:' + id); console.log('UPLOAD_READY ' + id); }
    }
    const { data: fb } = await db.storage.from('design-uploads').list('feedback', { limit: 200 });
    for (const f of (fb || []).filter(x => x.name.endsWith('.json'))) {
      const id = f.name.replace(/\.json$/, '');
      if (!seen.has('f:' + id)) { seen.add('f:' + id); console.log('FEEDBACK ' + id); }
    }
  } catch (e) { /* still poll */ }
  await new Promise(r => setTimeout(r, 12000));
}

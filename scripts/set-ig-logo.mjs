// Setzt das ECHTE Instagram-Profilbild als Betriebs-Logo (statt Crop aus dem Design).
//   node scripts/set-ig-logo.mjs <slug> "<instagram-image-url>"
// Lädt das Bild, schneidet es sauber quadratisch (256x256), lädt es in den
// brand-logos-Bucket und setzt businesses.logo_url (mit Cache-Bust).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import sharp from 'sharp';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const slug = process.argv[2];
const url = process.argv[3];
if (!slug || !url) { console.error('Aufruf: node scripts/set-ig-logo.mjs <slug> "<bild-url>"'); process.exit(1); }

const { data: biz } = await db.from('businesses').select('id,name,slug').eq('slug', slug).maybeSingle();
if (!biz) { console.error('Betrieb nicht gefunden:', slug); process.exit(1); }

const res = await fetch(url);
if (!res.ok) { console.error('Bild-Download fehlgeschlagen:', res.status); process.exit(1); }
const raw = Buffer.from(await res.arrayBuffer());

// sauberes quadratisches Avatar (256), randscharf
const png = await sharp(raw).resize(256, 256, { fit: 'cover', position: 'centre' }).png().toBuffer();

const path = `${slug}.png`;
const up = await db.storage.from('brand-logos').upload(path, png, { contentType: 'image/png', upsert: true });
if (up.error) { console.error('Upload-Fehler:', up.error.message); process.exit(1); }

const base = db.storage.from('brand-logos').getPublicUrl(path).data.publicUrl;
const logo_url = `${base}?v=${Date.now()}`;   // Cache-Bust, damit das neue Bild sofort erscheint
const { error: uErr } = await db.from('businesses').update({ logo_url }).eq('id', biz.id);
if (uErr) { console.error('DB-Update-Fehler:', uErr.message); process.exit(1); }

console.log(`✅ ${biz.name}: echtes IG-Profilbild gesetzt -> ${logo_url}`);

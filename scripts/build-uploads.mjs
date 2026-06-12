// Holt hochgeladene Design-Bilder aus dem Storage (design-uploads/pending/),
// baut daraus eine funktionierende Stempelkarte + legt den Betrieb an.
// Danach EINMAL deployen:  npx vercel --prod --yes
//
//   node scripts/build-uploads.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

// passende Hintergrundfarbe automatisch aus dem Design ziehen
async function dominantHex(buf) {
  try { const { dominant: d } = await sharp(buf).stats(); return '#' + [d.r, d.g, d.b].map(v => v.toString(16).padStart(2, '0')).join(''); }
  catch { return '#1c130f'; }
}
function textFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
}

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const BUCKET = 'design-uploads';

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32) || 'betrieb';
}
const pick = (set,n)=>Array.from({length:n},()=>set[Math.floor(Math.random()*set.length)]).join('');

mkdirSync('_brand', { recursive: true });
const { data: files } = await db.storage.from(BUCKET).list('pending', { limit: 100 });
const metas = (files || []).filter(f => f.name.endsWith('.json'));
if (!metas.length) { console.log('Keine offenen Uploads.'); process.exit(0); }
console.log(`${metas.length} Upload(s) gefunden.\n`);

const built = [];
for (const mf of metas) {
  const id = mf.name.replace(/\.json$/, '');
  try {
    const { data: mjson } = await db.storage.from(BUCKET).download(`pending/${id}.json`);
    const meta = JSON.parse(await mjson.text());
    const { data: img } = await db.storage.from(BUCKET).download(`pending/${id}.png`);
    const imgBuf = Buffer.from(await img.arrayBuffer());
    if (meta.note) console.log(`  📝 Hinweis vom User: ${meta.note}`);

    const slug = slugify(meta.name) + '-' + pick('abcdefghijkmnpqrstuvwxyz23456789', 3);
    const imgPath = join('_brand', `${slug}.png`);
    writeFileSync(imgPath, imgBuf);

    // Farbe automatisch aus dem Design (oder vom User vorgegeben)
    const colorBg = meta.color_bg || await dominantHex(imgBuf);
    const colorText = textFor(colorBg);
    console.log(`  Auto-Farbe: ${colorBg} (Text ${colorText})`);

    // Profilbild: bevorzugt hochgeladenes Logo, sonst Marken-Ecke (oben links) -> auf farbiges Quadrat.
    let logoUrl = null, logoPath = null;
    try {
      let inner, provided = false;
      if (meta.hasLogo) {
        const { data: lg } = await db.storage.from('design-uploads').download(`pending/${id}-logo.png`);
        if (lg) { inner = Buffer.from(await lg.arrayBuffer()); provided = true; }
      }
      if (!inner) {
        const m2 = await sharp(imgBuf).metadata();
        inner = await sharp(imgBuf).extract({
          left: Math.round(m2.width * 0.012), top: Math.round(m2.height * 0.06),
          width: Math.round(m2.width * 0.24), height: Math.round(m2.height * 0.24),
        }).png().toBuffer();
      }
      logoPath = join('_brand', `${slug}-logo.png`);
      writeFileSync(logoPath, inner); // fürs Pass-Icon (makeIcon legt es auf Farbquadrat)
      // Dashboard-Avatar: Logo zentriert auf abgerundetem Farbquadrat
      const S = 256, pad = provided ? 26 : 18;
      const fitted = await sharp(inner).resize(S - 2 * pad, S - 2 * pad, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const avatar = await sharp(Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${Math.round(S * 0.22)}" fill="${colorBg}"/></svg>`))
        .composite([{ input: fitted, gravity: 'centre' }]).png().toBuffer();
      await db.storage.from('brand-logos').upload(`${slug}.png`, avatar, { contentType: 'image/png', upsert: true });
      logoUrl = db.storage.from('brand-logos').getPublicUrl(`${slug}.png`).data.publicUrl;
    } catch (e) { console.log('  Logo übersprungen:', e.message); }

    // Vom User im Upload selbst gesetzte Stempel-Positionen (bevorzugt), sonst pos-Datei.
    let stampPositions = (Array.isArray(meta.positions) && meta.positions.length) ? meta.positions : null;
    let stampRfr = (typeof meta.rfr === 'number') ? meta.rfr : null;
    if (stampPositions) console.log(`  ✋ Positionen vom User gesetzt (${stampPositions.length})`);
    const posFile = join('_brand', `${id}-pos.json`);
    if (!stampPositions && existsSync(posFile)) {
      try { const p = JSON.parse(readFileSync(posFile, 'utf8')); stampPositions = p.positions || p.stampPositions || null; stampRfr = p.rfr || p.stampRfr || null; } catch {}
      if (stampPositions) console.log(`  Positionen aus ${id}-pos.json (${stampPositions.length})`);
    }

    // 1) Assets bauen (Upload-Bild als Hintergrund, funktionierende Stempel drauf)
    const genCfg = join('_brand', `${slug}-gen.json`);
    writeFileSync(genCfg, JSON.stringify({ slug, name: meta.name, goal: meta.goal, colorBg,
      colorText, reward: meta.reward, bgPath: imgPath, fillOnly: true, logoPath, stampPositions, stampRfr }));
    execSync(`node scripts/gen-business-assets.mjs "${genCfg}"`, { stdio: 'inherit' });

    // 2) Betrieb anlegen
    const email = `${slug}@kunden.flowstate.app`;
    const password = 'FS-' + pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 4) + pick('23456789', 3);
    const provCfg = join('_brand', `${slug}-prov.json`);
    writeFileSync(provCfg, JSON.stringify({ slug, name: meta.name, goal: meta.goal, colorBg,
      colorText, reward: meta.reward, email, password, logoUrl }));
    execSync(`node scripts/provision-custom.mjs "${provCfg}"`, { stdio: 'inherit' });

    // 3) Upload als erledigt markieren (nach processed/ verschieben)
    await db.storage.from(BUCKET).copy(`pending/${id}.png`, `processed/${id}.png`).catch(()=>{});
    await db.storage.from(BUCKET).copy(`pending/${id}.json`, `processed/${id}.json`).catch(()=>{});
    await db.storage.from(BUCKET).remove([`pending/${id}.png`, `pending/${id}.json`, `pending/${id}-logo.png`]);

    built.push({ name: meta.name, slug, email, password });
  } catch (e) {
    console.error(`FEHLER bei ${id}:`, e.message);
  }
}

if (built.length) {
  console.log('\n================ FERTIG GEBAUT ================');
  for (const b of built) console.log(`• ${b.name}  (slug ${b.slug})  Login: ${b.email} / ${b.password}`);
  console.log('\n>>> Deploye automatisch …');
  try { execSync('npx vercel --prod --yes', { stdio: 'inherit' }); console.log('✅ Deployed — Betrieb(e) jetzt im Cockpit.'); }
  catch (e) { console.error('Deploy-Fehler:', e.message); }
}

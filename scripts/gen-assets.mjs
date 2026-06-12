// Pre-generiert strip+icon Assets pro Design-Variante -> api/_assets/<key>/
// So braucht /api/pass zur Laufzeit kein sharp (schneller/robuster auf Vercel).
//
// Stempelkarten: ORIGINAL-Design + gruener Haken ueber die vollen Stempel.
//   Pro Fuellstand ein Bild strip_<n>.png (n = volle Stempel).
//   stamp5 -> strip_0..strip_5     stamp10 -> strip_0..strip_10
// Gutschein: aus Design-Bild (falls vorhanden), sonst uebersprungen.
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'api', '_assets');
const L = 'C:/Users/maykt/Downloads/lila/';
const LILA = '#b8a5dc';
const GREEN = '#34b463';
const SW = 1125, SH = 432;               // 3x-Basis (Apple strip)
const SIZES = [375, 750, 1125];          // 1x / 2x / 3x
const SUF = { 375: '', 750: '@2x', 1125: '@3x' };

// Positionen der aufgedruckten Stempel-Kreise im 1125x432-Design (gemessen).
const LAYOUT = {
  stamp5:  { src: 'e7d3f4be-715b-42eb-9c39-282093e8045b.png', total: 5,  r: 52, cols: [103, 233, 363, 493, 621], rows: [296] },
  stamp10: { src: '5dea4dd6-8b2f-4a55-97de-fce32b53c9c3.png', total: 10, r: 42, cols: [94, 214, 333, 451, 567], rows: [240, 344] },
};

function pos(layout, i) {
  const per = layout.cols.length;
  return { cx: layout.cols[i % per], cy: layout.rows[Math.floor(i / per)] };
}
function checkMark(cx, cy, r) {
  const k = r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>`
       + `<path d="M ${cx - 0.42*k} ${cy + 0.04*k} L ${cx - 0.12*k} ${cy + 0.38*k} L ${cx + 0.45*k} ${cy - 0.36*k}" `
       + `fill="none" stroke="#ffffff" stroke-width="${r*0.22}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function overlaySvg(layout, filled) {
  let s = '';
  for (let i = 0; i < filled; i++) { const { cx, cy } = pos(layout, i); s += checkMark(cx, cy, layout.r); }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">${s}</svg>`;
}

async function icon(size) {
  const svg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size*0.2}" fill="rgb(184,165,220)"/><text x="50%" y="63%" font-family="Georgia,serif" font-size="${size*0.5}" font-weight="700" fill="#3d2a73" text-anchor="middle">l.</text></svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}
async function writeIcons(dir) {
  writeFileSync(join(dir, 'icon.png'), await icon(29));
  writeFileSync(join(dir, 'icon@2x.png'), await icon(58));
  writeFileSync(join(dir, 'icon@3x.png'), await icon(87));
}

async function genStamp(key) {
  const layout = LAYOUT[key];
  const dir = join(OUT, key);
  mkdirSync(dir, { recursive: true });
  // Dein Original-Design als Basis (cover -> 1125x432)
  const base = await sharp(L + layout.src).resize(SW, SH, { fit: 'cover' }).png().toBuffer();
  for (let n = 0; n <= layout.total; n++) {
    const composed = n === 0
      ? base
      : await sharp(base).composite([{ input: Buffer.from(overlaySvg(layout, n)), top: 0, left: 0 }]).png().toBuffer();
    for (const w of SIZES) {
      writeFileSync(join(dir, `strip_${n}${SUF[w]}.png`), await sharp(composed).resize({ width: w }).png().toBuffer());
    }
  }
  // Fallback strip.png = leerer Stand
  for (const w of SIZES) {
    writeFileSync(join(dir, `strip${SUF[w]}.png`), await sharp(base).resize({ width: w }).png().toBuffer());
  }
  await writeIcons(dir);
  console.log('OK', key, '(0..' + layout.total + ')');
}

// --- Gutschein-Strip aus fertigem Querformat-Design (kein Beschnitt/Fade noetig) ---
async function genCoupon(designPath) {
  if (!existsSync(designPath)) { console.log('SKIP coupon: Design-Bild fehlt, behalte vorhandenes'); return; }
  const dir = join(OUT, 'coupon');
  mkdirSync(dir, { recursive: true });
  const design = readFileSync(designPath);
  for (const w of SIZES) {
    writeFileSync(join(dir, `strip${SUF[w]}.png`), await sharp(design).resize(SW, SH, { fit: 'cover' }).resize({ width: w }).png().toBuffer());
  }
  await writeIcons(dir);
  console.log('OK coupon');
}

await genStamp('stamp5');
await genStamp('stamp10');
await genCoupon(L + 'GIFTCARD FINAL 20%.png');
console.log('Assets fertig -> api/_assets/');

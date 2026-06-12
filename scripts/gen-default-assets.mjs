// Default-Pass-Assets fuer ALLE Nicht-Lila-Betriebe (Multi-Tenant).
// Transparente Strips -> die backgroundColor des Passes (= Betriebsfarbe) scheint durch.
// So ist jede Karte automatisch farb-personalisiert, ohne pro Betrieb etwas zu generieren.
//   default-stamp10/strip_0..10   default-stamp5/strip_0..5   default-coupon/strip
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'api', '_assets');
const SW = 1125, SH = 432, SIZES = [375, 750, 1125], SUF = { 375: '', 750: '@2x', 1125: '@3x' };
const GREEN = '#34b463', W = '#ffffff';
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';

const STAMP = {
  'default-stamp10': { total: 10, r: 54, cols: [150, 356, 562, 768, 974], rows: [156, 300] },
  'default-stamp5':  { total: 5,  r: 64, cols: [150, 356, 562, 768, 974], rows: [232] },
};

function pos(L, i) { const per = L.cols.length; return { cx: L.cols[i % per], cy: L.rows[Math.floor(i / per)] }; }
function emptyCircle(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.06)" stroke="${W}" stroke-width="3.5" stroke-opacity="0.85"/>`;
}
function checkMark(cx, cy, r) {
  const k = r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>`
       + `<path d="M ${cx-0.42*k} ${cy+0.04*k} L ${cx-0.12*k} ${cy+0.38*k} L ${cx+0.45*k} ${cy-0.36*k}" `
       + `fill="none" stroke="${W}" stroke-width="${r*0.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function stampSvg(L, filled) {
  let s = `<text x="62" y="62" font-family="${FONT}" font-size="27" font-weight="700" fill="${W}" fill-opacity="0.92" letter-spacing="3">SAMMLE ${L.total} STEMPEL</text>`;
  for (let i = 0; i < L.total; i++) {
    const { cx, cy } = pos(L, i);
    s += (i < filled) ? checkMark(cx, cy, L.r) : emptyCircle(cx, cy, L.r);
    s += `<text x="${cx}" y="${cy + L.r + 34}" font-family="${FONT}" font-size="25" font-weight="600" fill="${W}" fill-opacity="0.7" text-anchor="middle">${i + 1}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">${s}</svg>`;
}
function couponSvg() {
  const s = `<text x="62" y="150" font-family="${FONT}" font-size="96" font-weight="800" fill="${W}">GUTSCHEIN</text>`
    + `<text x="66" y="232" font-family="${FONT}" font-size="30" font-weight="600" fill="${W}" fill-opacity="0.8" letter-spacing="4">DEIN VORTEIL</text>`
    + `<circle cx="985" cy="150" r="120" fill="rgba(255,255,255,0.10)"/>`
    + `<path d="M925 150 l28 28 l60 -64" fill="none" stroke="${W}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">${s}</svg>`;
}

async function icon(size) {
  // Neutrales Icon: abgerundetes Quadrat (indigo) mit weissem Haken
  const r = size * 0.2, k = size;
  const svg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#6b5cff"/>`
    + `<path d="M ${0.3*k} ${0.52*k} L ${0.44*k} ${0.66*k} L ${0.72*k} ${0.36*k}" fill="none" stroke="#fff" stroke-width="${size*0.09}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}
async function writeIcons(dir) {
  writeFileSync(join(dir, 'icon.png'), await icon(29));
  writeFileSync(join(dir, 'icon@2x.png'), await icon(58));
  writeFileSync(join(dir, 'icon@3x.png'), await icon(87));
}
async function pngAt(svg, width) {
  return await sharp(Buffer.from(svg), { density: 200 }).resize({ width }).png().toBuffer();
}

for (const [key, L] of Object.entries(STAMP)) {
  const dir = join(OUT, key); mkdirSync(dir, { recursive: true });
  for (let n = 0; n <= L.total; n++) {
    const svg = stampSvg(L, n);
    for (const w of SIZES) writeFileSync(join(dir, `strip_${n}${SUF[w]}.png`), await pngAt(svg, w));
  }
  for (const w of SIZES) writeFileSync(join(dir, `strip${SUF[w]}.png`), await pngAt(stampSvg(L, 0), w));
  await writeIcons(dir);
  console.log('OK', key, '(0..' + L.total + ')');
}
// default-coupon
{
  const dir = join(OUT, 'default-coupon'); mkdirSync(dir, { recursive: true });
  for (const w of SIZES) writeFileSync(join(dir, `strip${SUF[w]}.png`), await pngAt(couponSvg(), w));
  await writeIcons(dir);
  console.log('OK default-coupon');
}

// Vorschau: Strips ueber eine Beispiel-Betriebsfarbe legen (sonst sieht man weiss auf weiss nicht)
const bg = await sharp({ create: { width: SW, height: SH, channels: 4, background: '#6b5cff' } }).png().toBuffer();
const previews = [
  ['default-stamp10', 'strip_3@3x.png', '_prev_stamp10.png'],
  ['default-stamp5', 'strip_2@3x.png', '_prev_stamp5.png'],
  ['default-coupon', 'strip@3x.png', '_prev_coupon.png'],
];
for (const [k, f, out] of previews) {
  await sharp(bg).composite([{ input: join(OUT, k, f) }]).png().toFile(out);
}
console.log('Vorschauen: _prev_stamp10.png / _prev_stamp5.png / _prev_coupon.png');

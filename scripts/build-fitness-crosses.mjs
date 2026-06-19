// Baut progressive Strips strip_0..N für die Zeit-Pässe: graue Haken überdecken (leere Box),
// dann gemalte ROTE Kreuze pro vergangenem Tag. Position aus Pixel-Messung (Quelle 2023x777).
//   node scripts/build-fitness-crosses.mjs
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ASSETS = 'api/_assets';
const SRC = 'C:/Users/maykt/Downloads/Fitness first dashboard/';
const PAL = { palette: true, quality: 82, effort: 8, compressionLevel: 9 };
const SW = 2023;
const OUT = [[1125, 432, '@3x'], [750, 288, '@2x'], [375, 144, '']];
const COVER = '#101010';   // Box-Innenfarbe (gemessen rgb 16,16,16)
const RED = '#e3001f';

// Gemalter roter X — zwei leicht gebogene Striche, runde Enden (wirkt handgemalt, nicht digital).
function crossSVG(size) {
  const w = Math.max(3, Math.round(size * 0.15));
  const a = Math.round(size * 0.16), b = size - a;
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${RED}" stroke-width="${w}" stroke-linecap="round" fill="none">
      <path d="M${a} ${a} Q${size * 0.53} ${Math.round(size * 0.47)} ${b} ${b}"/>
      <path d="M${b} ${a} Q${Math.round(size * 0.47)} ${size * 0.54} ${a} ${b}"/>
    </g></svg>`);
}

const jobs = [
  { dir: 'biz-fitness-first-wiesbaden-c71e2a8bd', file: 'WhatsApp Image 2026-06-14 at 16.51.32.jpeg', n: 7,
    xs: [222, 483, 748, 1014, 1279, 1544, 1805], crossY: 510, coverY0: 388, coverY1: 665, coverHW: 112, cross: 150 },
  { dir: 'biz-fitness-first-wiesbaden-cfa31866f', file: 'WhatsApp Image 2026-06-14 at 16.56.47.jpeg', n: 3,
    xs: [361, 805, 1253], crossY: 510, coverY0: 388, coverY1: 665, coverHW: 175, cross: 195 },
];

for (const j of jobs) {
  const dir = join(ASSETS, j.dir); mkdirSync(dir, { recursive: true });
  for (let k = 0; k <= j.n; k++) {
    for (const [ow, oh, suf] of OUT) {
      const sx = ow / SW;
      const comps = [];
      const coverW = Math.round(j.coverHW * 2 * sx), coverH = Math.round((j.coverY1 - j.coverY0) * sx);
      const coverSVG = Buffer.from(`<svg width="${coverW}" height="${coverH}" xmlns="http://www.w3.org/2000/svg"><rect width="${coverW}" height="${coverH}" rx="${Math.round(6 * sx)}" fill="${COVER}"/></svg>`);
      for (const cx of j.xs) comps.push({ input: coverSVG, left: Math.round((cx - j.coverHW) * sx), top: Math.round(j.coverY0 * sx) });
      const cs = Math.round(j.cross * sx);
      const xsvg = crossSVG(cs);
      for (let i = 0; i < k; i++) comps.push({ input: xsvg, left: Math.round(j.xs[i] * sx - cs / 2), top: Math.round(j.crossY * sx - cs / 2) });
      await sharp(SRC + j.file).resize(ow, oh).composite(comps).png(PAL).toFile(join(dir, `strip_${k}${suf}.png`));
    }
  }
  // 'strip' (Fallback) = leerer Stand strip_0
  for (const [, , suf] of OUT) await sharp(join(dir, `strip_0${suf}.png`)).toFile(join(dir, `strip${suf}.png`));
  console.log(`Kreuze gebaut: ${j.dir} (strip_0..${j.n})`);
}
console.log('Fertig.');

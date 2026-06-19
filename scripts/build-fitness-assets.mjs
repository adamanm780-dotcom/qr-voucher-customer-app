// Baut per-Aktion-Assets (Strip + Icon) aus den Fitness-First-Designs.
//   node scripts/build-fitness-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ASSETS = 'api/_assets';
const SRC = 'C:/Users/maykt/Downloads/Fitness first dashboard';
const PAL = { palette: true, quality: 82, effort: 8, compressionLevel: 9 };  // Bundle-Größe klein halten
const BG = { r: 10, g: 10, b: 12 };
const STRIP = [[1125, 432, '@3x'], [750, 288, '@2x'], [375, 144, '']];
const ICON = [[87, '@3x'], [58, '@2x'], [29, '']];

const jobs = [
  { dir: 'biz-fitness-first-wiesbaden-c71e2a8bd', file: 'WhatsApp Image 2026-06-14 at 16.51.32.jpeg', name: '7-Tage' },
  { dir: 'biz-fitness-first-wiesbaden-cfa31866f', file: 'WhatsApp Image 2026-06-14 at 16.56.47.jpeg', name: '3-Tage' },
  { dir: 'biz-fitness-first-wiesbaden-cec7f9fbf', file: 'WhatsApp Image 2026-06-14 at 17.04.22.jpeg', name: 'Protein' },
];

for (const j of jobs) {
  const dir = join(ASSETS, j.dir); mkdirSync(dir, { recursive: true });
  const src = join(SRC, j.file);
  // Strip: Design contain auf schwarzem Grund (nichts abschneiden, farbgleiche Ränder)
  for (const [w, h, suf] of STRIP) {
    await sharp(src).resize(w, h, { fit: 'contain', background: BG }).png(PAL).toFile(join(dir, `strip${suf}.png`));
  }
  // Icon: Fitness-First-Logo (oben links) -> Quadrat auf Schwarz
  const m = await sharp(src).metadata();
  const logo = await sharp(src).extract({
    left: Math.round(m.width * 0.02), top: Math.round(m.height * 0.05),
    width: Math.round(m.width * 0.085), height: Math.round(m.height * 0.20),
  }).toBuffer();
  for (const [s, suf] of ICON) {
    const inner = await sharp(logo).resize(s - 4, s - 4, { fit: 'contain', background: { ...BG, alpha: 1 } }).toBuffer();
    await sharp({ create: { width: s, height: s, channels: 4, background: { ...BG, alpha: 1 } } })
      .composite([{ input: inner, gravity: 'centre' }]).png(PAL).toFile(join(dir, `icon${suf}.png`));
  }
  console.log(`gebaut: ${j.name} -> ${j.dir}`);
}
console.log('Fertig.');

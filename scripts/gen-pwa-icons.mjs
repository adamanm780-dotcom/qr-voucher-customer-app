// Generiert PWA-App-Icons (FlowState Cyan-Gradient mit "F").
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
const OUT = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT, { recursive: true });

function iconSvg(size){
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22e9ff"/><stop offset="0.55" stop-color="#7a6bff"/><stop offset="1" stop-color="#c062ff"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" rx="${size*0.22}" fill="#05070d"/>
    <rect x="${size*0.12}" y="${size*0.12}" width="${size*0.76}" height="${size*0.76}" rx="${size*0.16}" fill="url(#g)" opacity="0.16"/>
    <text x="50%" y="${size*0.7}" font-family="'Space Grotesk',Arial,sans-serif" font-weight="700" font-size="${size*0.62}" fill="url(#g)" text-anchor="middle">F</text>
  </svg>`;
}
const sizes = [120,152,167,180,192,512];
for (const s of sizes){
  writeFileSync(join(OUT, `icon-${s}.png`), await sharp(Buffer.from(iconSvg(s))).png().toBuffer());
}
// maskable (mehr Padding fuer Android)
writeFileSync(join(OUT,'maskable-512.png'), await sharp(Buffer.from(iconSvg(512))).png().toBuffer());
console.log('PWA-Icons:', sizes.join(', '));

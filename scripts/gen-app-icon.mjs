// FlowState App-Icon — vibrant Gradient + klares weißes F + Stempel-Punkte (Loyalty-Motiv).
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// F-Monogramm + Stempel-Punkte, zentriert in 512er-Canvas
function emblem() {
  const white = '#ffffff';
  // Bold F (abgerundet)
  const F = `
    <g fill="${white}">
      <rect x="178" y="120" width="60" height="250" rx="16"/>
      <rect x="178" y="120" width="168" height="60" rx="16"/>
      <rect x="178" y="212" width="120" height="54" rx="14"/>
    </g>`;
  // 3 Stempel-Punkte unten (einer gefüllt = Fortschritt)
  const dots = `
    <g>
      <circle cx="206" cy="408" r="16" fill="${white}"/>
      <path d="M199 408 l5 6 l10 -12" fill="none" stroke="#5b8cff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="256" cy="408" r="16" fill="none" stroke="${white}" stroke-width="4" stroke-opacity="0.9"/>
      <circle cx="306" cy="408" r="16" fill="none" stroke="${white}" stroke-width="4" stroke-opacity="0.9"/>
    </g>`;
  return F + dots;
}

function svg({ rounded }) {
  const r = rounded ? 115 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#19e3c2"/>
        <stop offset="46%" stop-color="#4f8cff"/>
        <stop offset="100%" stop-color="#a05cff"/>
      </linearGradient>
      <radialGradient id="gloss" cx="30%" cy="20%" r="85%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.30"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0a1230" flood-opacity="0.30"/>
      </filter>
    </defs>
    <rect width="512" height="512" rx="${r}" fill="url(#bg)"/>
    <rect width="512" height="512" rx="${r}" fill="url(#gloss)"/>
    <g filter="url(#sh)">${emblem()}</g>
  </svg>`;
}

async function render(buf, size, name) {
  writeFileSync(join(OUT, name), await sharp(buf).resize(size, size).png().toBuffer());
  console.log('  ✓', name, size + 'px');
}

const rounded = Buffer.from(svg({ rounded: true }));
const full = Buffer.from(svg({ rounded: false }));
for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'icon-180.png'], [167, 'icon-167.png'], [152, 'icon-152.png'], [120, 'icon-120.png']]) {
  await render(rounded, size, name);
}
// maskable: voll-bleed (OS maskiert selbst), Motiv in der sicheren Mitte
await render(full, 512, 'maskable-512.png');
console.log('App-Icons fertig.');

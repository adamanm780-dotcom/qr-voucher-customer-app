// FlowState App-Icon — Premium-Mark: tiefdunkler Grund, F-Monogramm mit ruhigem
// Mint→Blau-Verlauf, Hairline-Highlight. Kein Gloss, keine Deko.
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// F-Monogramm: Stem + Top-Arm in Off-White, Mittelbalken als einziger Farbakzent.
// Crisp (kleine Radien), optisch zentriert (Extent x 174..344, y 130..382)
function emblem() {
  return `
    <g>
      <path d="M174 144 q0 -14 14 -14 h142 q14 0 14 14 v34 q0 14 -14 14 h-94 v178 q0 14 -14 14 h-34 q-14 0 -14 -14 z" fill="#f2f5fa"/>
      <rect x="236" y="240" width="100" height="56" rx="12" fill="url(#mark)"/>
    </g>`;
}

function svg({ rounded }) {
  const r = rounded ? 115 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#12161f"/>
        <stop offset="100%" stop-color="#0a0d14"/>
      </linearGradient>
      <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3ce8c4"/>
        <stop offset="100%" stop-color="#4f7dff"/>
      </linearGradient>
      <radialGradient id="glow" cx="42%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#3ce8c4" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#3ce8c4" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" rx="${r}" fill="url(#bg)"/>
    <rect width="512" height="512" rx="${r}" fill="url(#glow)"/>
    ${rounded ? `<rect x="1.5" y="1.5" width="509" height="509" rx="113.5" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="3"/>` : ''}
    ${emblem()}
  </svg>`;
}

async function render(buf, size, name) {
  writeFileSync(join(OUT, name), await sharp(buf).resize(size, size).png().toBuffer());
  console.log('  ✓', name, size + 'px');
}

// iOS/Android maskieren Icons selbst -> volle Fläche, keine transparenten Ecken.
const full = Buffer.from(svg({ rounded: false }));
const roundedBuf = Buffer.from(svg({ rounded: true }));
for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'icon-180.png'], [167, 'icon-167.png'], [152, 'icon-152.png'], [120, 'icon-120.png']]) {
  await render(full, size, name);
}
await render(full, 512, 'maskable-512.png');

// Transparentes Mark (nur das F) fuer Header/Login statt altem Logo.
const markOnly = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3ce8c4"/>
      <stop offset="100%" stop-color="#4f7dff"/>
    </linearGradient>
  </defs>
  ${emblem()}
</svg>`);
writeFileSync(join(process.cwd(), 'public', 'assets', 'logo-mark.png'),
  await sharp(markOnly).extract({ left: 142, top: 102, width: 228, height: 308 }).resize(228, 308).png().toBuffer());
console.log('  ✓ assets/logo-mark.png (transparent)');
console.log('App-Icons fertig.');

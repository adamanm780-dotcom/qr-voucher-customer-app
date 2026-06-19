const sharp = require('sharp');
const fs = require('fs');

const CARD = 'C:/Users/maykt/bjhero/card-real.png';
const OUT  = 'C:/Users/maykt/Downloads/flowstate-zeta/assets/hero-wallet.png';

const W = 920, H = 1860, FR = 124, INS = 22, SR = 104;

// Phone frame + screen + chrome (everything except the card), transparent outside.
const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a3f4c"/><stop offset=".18" stop-color="#23262f"/>
      <stop offset=".5" stop-color="#0d0f15"/><stop offset=".82" stop-color="#23262f"/>
      <stop offset="1" stop-color="#3a3f4c"/>
    </linearGradient>
    <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c1018"/><stop offset="1" stop-color="#06080d"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".10"/>
      <stop offset=".25" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- outer frame -->
  <rect x="2" y="2" width="${W-4}" height="${H-4}" rx="${FR}" fill="url(#frame)" stroke="#454b59" stroke-width="2"/>
  <!-- screen -->
  <rect x="${INS}" y="${INS}" width="${W-INS*2}" height="${H-INS*2}" rx="${SR}" fill="url(#scr)"/>
  <!-- dynamic island -->
  <rect x="${W/2-95}" y="58" width="190" height="38" rx="19" fill="#000"/>
  <!-- status bar -->
  <text x="78" y="150" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#eef2fa">9:41</text>
  <g fill="#eef2fa">
    <rect x="${W-176}" y="128" width="26" height="18" rx="3" opacity=".9"/>
    <circle cx="${W-128}" cy="137" r="9" opacity=".9"/>
    <rect x="${W-104}" y="126" width="44" height="22" rx="6" opacity=".9"/>
  </g>
  <!-- "Fertig" wallet action -->
  <text x="${W-72}" y="232" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="600" fill="#5ea0ff">Fertig</text>
  <!-- home indicator -->
  <rect x="${W/2-110}" y="${H-58}" width="220" height="10" rx="5" fill="#ffffff" opacity=".55"/>
  <!-- subtle screen gloss on top of everything -->
  <rect x="${INS}" y="${INS}" width="${W-INS*2}" height="${H-INS*2}" rx="${SR}" fill="url(#gloss)"/>
</svg>`;

(async () => {
  const base = await sharp(Buffer.from(phoneSvg)).png().toBuffer();
  const cardW = 740;
  const card = await sharp(CARD).resize({ width: cardW }).toBuffer();
  const cardMeta = await sharp(card).metadata();
  const left = Math.round((W - cardW) / 2);
  const top  = 286;
  await sharp(base)
    .composite([{ input: card, left, top }])
    .png()
    .toFile(OUT);
  console.log('OK ->', OUT, fs.statSync(OUT).size, 'bytes  card', cardMeta.width + 'x' + cardMeta.height);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

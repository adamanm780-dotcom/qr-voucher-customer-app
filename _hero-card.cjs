const sharp = require('sharp');
const fs = require('fs');

const EX = 'C:/Users/maykt/bjpass/ex';
const QR = 'C:/Users/maykt/bjpass/qr.png';
const OUT = 'C:/Users/maykt/bjhero/card-real.png';

const b64 = (p) => fs.readFileSync(p).toString('base64');
const strip = 'data:image/png;base64,' + b64(EX + '/strip@3x.png');
const icon  = 'data:image/png;base64,' + b64(EX + '/icon@3x.png');
const qr    = 'data:image/png;base64,' + b64(QR);

const W = 760, H = 980, R = 46;
const stripY = 96, stripH = Math.round(W / 2.6); // 292

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="${R}" ry="${R}"/></clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfaee0"/><stop offset="1" stop-color="#b09bd6"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#card)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
    <!-- header (logoText, Apple-Wallet-style) -->
    <text x="44" y="63" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" fill="#3d2a73">Lila Wiesbaden</text>
    <!-- strip -->
    <image href="${strip}" x="0" y="${stripY}" width="${W}" height="${stripH}" preserveAspectRatio="xMidYMid slice"/>
    <!-- field -->
    <text x="40" y="${stripY + stripH + 70}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" letter-spacing="2" fill="#5a418c">GÜLTIG BIS</text>
    <text x="40" y="${stripY + stripH + 114}" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="#3d2a73">31.12.2026</text>
    <!-- barcode -->
    <rect x="230" y="600" width="300" height="330" rx="20" fill="#ffffff"/>
    <image href="${qr}" x="260" y="630" width="240" height="240"/>
    <text x="380" y="905" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" letter-spacing="3" fill="#1d1530">FS-54A73F</text>
  </g>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .resize({ width: 1100 })  // upscale for crispness
  .toFile(OUT)
  .then(() => console.log('OK ->', OUT, fs.statSync(OUT).size, 'bytes'))
  .catch(e => { console.error('ERR', e.message); process.exit(1); });

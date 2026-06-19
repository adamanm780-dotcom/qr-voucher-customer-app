const sharp = require('sharp');
const fs = require('fs');

const QR = 'C:/Users/maykt/bjpass/qr.png';
const OUT = 'C:/Users/maykt/Downloads/flowstate-zeta/assets/hero-wallet.png';
const qrB64 = 'data:image/png;base64,' + fs.readFileSync(QR).toString('base64');

const W = 900, H = 1950;          // screen
const MX = 36, CW = W - MX * 2, R = 30;
const SANS = "Arial, Helvetica, sans-serif";

// collapsed peeking cards (top -> down)
const cards = [
  { name: 'Bäckerei Korn',  bg1:'#efe4c9', bg2:'#e4d4ab', fg:'#2a2418', mut:'#7c6f4f', label:'STEMPEL', val:'2/5' },
  { name: 'Glow Beauty',    bg1:'#e06aa6', bg2:'#c1497f', fg:'#ffffff', mut:'rgba(255,255,255,.7)', label:'PUNKTE', val:'40' },
  { name: 'Trattoria Sole', bg1:'#cf4636', bg2:'#a32d22', fg:'#ffffff', mut:'rgba(255,255,255,.72)', label:'STEMPEL', val:'4/6' },
  { name: 'PulseGym',       bg1:'#3f6dff', bg2:'#2348d8', fg:'#ffffff', mut:'rgba(255,255,255,.72)', label:'TAG', val:'2/7' },
];
const SY = 196, OFF = 104;

function collapsed(c, y){
  const r = MX + CW;
  return `
  <g>
    <rect x="${MX}" y="${y}" width="${CW}" height="150" rx="${R}" fill="url(#g_${c.key})"/>
    <text x="${MX+34}" y="${y+58}" font-family="${SANS}" font-size="31" font-weight="700" fill="${c.fg}">${c.name}</text>
    <text x="${r-34}" y="${y+40}" text-anchor="end" font-family="${SANS}" font-size="16" font-weight="700" letter-spacing="1.5" fill="${c.mut}">${c.label}</text>
    <text x="${r-34}" y="${y+80}" text-anchor="end" font-family="${SANS}" font-size="34" font-weight="700" fill="${c.fg}">${c.val}</text>
  </g>`;
}

// expanded flagship card
const EY = SY + cards.length * OFF;          // 196 + 416 = 612
const EH = H - EY - 56;
const CR = MX + CW;
const stripY = EY + 96, stripH = Math.round(CW / 2.6);   // ~318

// stamp circles inside strip (8, first 3 filled)
const N = 8, filled = 3;
const sGap = 14, sPad = 30;
const sSize = Math.floor((CW - sPad*2 - sGap*(N-1)) / N);
const sCy = stripY + stripH - sSize/2 - 26;
let stamps = '';
for (let i=0;i<N;i++){
  const cx = MX + sPad + sSize/2 + i*(sSize+sGap);
  if (i < filled){
    stamps += `<circle cx="${cx}" cy="${sCy}" r="${sSize/2}" fill="#ffffff"/>
      <path d="M ${cx-sSize*0.18} ${sCy} L ${cx-sSize*0.04} ${sCy+sSize*0.16} L ${cx+sSize*0.22} ${sCy-sSize*0.16}" fill="none" stroke="#16b56b" stroke-width="${Math.max(4,sSize*0.10)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    stamps += `<circle cx="${cx}" cy="${sCy}" r="${sSize/2}" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
      <text x="${cx}" y="${sCy+8}" text-anchor="middle" font-family="${SANS}" font-size="${sSize*0.42}" font-weight="700" fill="rgba(255,255,255,.85)">${i+1}</text>`;
  }
}

const qrSize = 300, qrY = stripY + stripH + 250;
const grads = cards.map((c,i)=>{ c.key='c'+i; return `<linearGradient id="g_c${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></linearGradient>`; }).join('');

const screen = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${grads}
    <linearGradient id="g_exp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1a18"/><stop offset="1" stop-color="#0e0d0c"/></linearGradient>
    <linearGradient id="g_strip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2bbd9e"/><stop offset=".55" stop-color="#1f9fb0"/><stop offset="1" stop-color="#3f6dff"/></linearGradient>
    <clipPath id="screenClip"><rect x="0" y="0" width="${W}" height="${H}" rx="2"/></clipPath>
  </defs>
  <g clip-path="url(#screenClip)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#000000"/>
    <!-- status bar -->
    <text x="44" y="56" font-family="${SANS}" font-size="30" font-weight="700" fill="#ffffff">20:33</text>
    <g fill="#ffffff">
      <rect x="${W-188}" y="34" width="6" height="14" rx="2"/><rect x="${W-178}" y="30" width="6" height="18" rx="2"/><rect x="${W-168}" y="26" width="6" height="22" rx="2"/><rect x="${W-158}" y="22" width="6" height="26" rx="2"/>
      <path d="M ${W-132} 40 a 20 16 0 0 1 40 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <rect x="${W-92}" y="26" width="40" height="22" rx="6"/><rect x="${W-49}" y="32" width="4" height="10" rx="2"/>
      <text x="${W-72}" y="44" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" fill="#000">29</text>
    </g>
    <!-- action row: X left, share+more right -->
    <circle cx="80" cy="138" r="34" fill="#1c1c1e"/>
    <path d="M 66 124 L 94 152 M 94 124 L 66 152" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <rect x="${W-236}" y="104" width="184" height="68" rx="34" fill="#1c1c1e"/>
    <path d="M ${W-188} 138 m -2 12 v -26 m 0 0 l -10 10 m 10 -10 l 10 10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#fff"><circle cx="${W-104}" cy="138" r="5"/><circle cx="${W-86}" cy="138" r="5"/><circle cx="${W-68}" cy="138" r="5"/></g>

    <!-- collapsed stack -->
    ${cards.map((c,i)=>collapsed(c, SY + i*OFF)).join('')}

    <!-- expanded flagship -->
    <rect x="${MX}" y="${EY}" width="${CW}" height="${EH}" rx="${R}" fill="url(#g_exp)"/>
    <text x="${MX+34}" y="${EY+60}" font-family="${SANS}" font-size="32" font-weight="700" fill="#ffffff">Café Lavanda</text>
    <text x="${CR-34}" y="${EY+42}" text-anchor="end" font-family="${SANS}" font-size="16" font-weight="700" letter-spacing="1.5" fill="rgba(255,255,255,.6)">STEMPEL</text>
    <text x="${CR-34}" y="${EY+82}" text-anchor="end" font-family="${SANS}" font-size="34" font-weight="700" fill="#ffffff">3/8</text>

    <!-- strip -->
    <rect x="${MX}" y="${stripY}" width="${CW}" height="${stripH}" fill="url(#g_strip)"/>
    <text x="${MX+30}" y="${stripY+52}" font-family="${SANS}" font-size="26" font-weight="800" fill="#04201c">CAFÉ LAVANDA</text>
    <text x="${MX+30}" y="${stripY+104}" font-family="${SANS}" font-size="40" font-weight="900" letter-spacing="1" fill="#ffffff">STEMPELKARTE</text>
    <text x="${MX+30}" y="${stripY+140}" font-family="${SANS}" font-size="20" font-weight="700" letter-spacing="3" fill="rgba(255,255,255,.85)">SAMMLE 8 · 1 GRATIS</text>
    ${stamps}

    <!-- reward -->
    <text x="${MX+34}" y="${stripY+stripH+62}" font-family="${SANS}" font-size="17" font-weight="700" letter-spacing="2" fill="rgba(255,255,255,.5)">BELOHNUNG</text>
    <text x="${MX+34}" y="${stripY+stripH+108}" font-family="${SANS}" font-size="40" font-weight="700" fill="#ffffff">Gratis-Kaffee</text>

    <!-- QR -->
    <rect x="${W/2 - qrSize/2}" y="${qrY}" width="${qrSize}" height="${qrSize+44}" rx="20" fill="#ffffff"/>
    <image href="${qrB64}" x="${W/2 - 120}" y="${qrY+30}" width="240" height="240"/>
    <text x="${W/2}" y="${qrY+qrSize+18}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="700" letter-spacing="2" fill="#16140f">NINI-7C3A21</text>

    <!-- home indicator -->
    <rect x="${W/2-110}" y="${H-30}" width="220" height="9" rx="5" fill="#ffffff" opacity=".5"/>
  </g>
</svg>`;

// thin premium frame around the screen
const FB = 16, FW = W + FB*2, FH = H + FB*2, FR = 70;
const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">
  <defs>
    <linearGradient id="fr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a4f5c"/><stop offset=".2" stop-color="#23262f"/><stop offset=".5" stop-color="#0c0e13"/><stop offset=".8" stop-color="#23262f"/><stop offset="1" stop-color="#4a4f5c"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="${FW-2}" height="${FH-2}" rx="${FR}" fill="url(#fr)" stroke="#565c6b" stroke-width="2"/>
</svg>`;

(async () => {
  const screenPng = await sharp(Buffer.from(screen)).png().toBuffer();
  // round the screen corners to sit in frame
  const rounded = await sharp(screenPng)
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" rx="56" ry="56"/></svg>`), blend: 'dest-in' }])
    .png().toBuffer();
  await sharp(Buffer.from(frame))
    .composite([{ input: rounded, left: FB, top: FB }])
    .png()
    .toFile(OUT);
  console.log('OK ->', OUT, fs.statSync(OUT).size, 'bytes', FW+'x'+FH);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

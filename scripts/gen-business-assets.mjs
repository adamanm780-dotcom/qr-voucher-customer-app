// FlowState — markentypische Pass-Assets pro Betrieb generieren.
// gpt-image-2 erzeugt den Marken-Hintergrund, sharp komponiert die funktionierenden
// Stempel-Slots (strip_0..goal) lesbar darüber. Ergebnis: api/_assets/biz-<slug>-stamp<goal>/.
//
// Aufruf:  node scripts/gen-business-assets.mjs <config.json>
//   config.json: { slug, name, goal(5|10), colorBg, colorText, accent, vibe, reward, logoPath?, bgPath?, quality? }
// Ohne Arg: eingebauter Test-Betrieb (zum Look-Beweis).
//
// Braucht: OPENAI_API_KEY in .env (Bild-Generierung). bgPath überspringt die KI (nutzt fertiges Bild).
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---- .env laden (nur OPENAI_API_KEY nötig) ----
const env = Object.fromEntries(
  readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SW = 1125, SH = 432, SIZES = [375, 750, 1125], SUF = { 375: '', 750: '@2x', 1125: '@3x' };
const GREEN = '#2fbf71', WHITE = '#ffffff';
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';

// Farb-Helfer: hex abdunkeln/aufhellen
function shade(hex, f) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim()); if (!m) return hex;
  const n = parseInt(m[1], 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, a = Math.abs(f);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Stempel-Layout (gleiche Positionen wie default, damit es ins System passt)
const LAYOUT = {
  5:  { total: 5,  r: 60, cols: [150, 356, 562, 768, 974], rows: [250] },
  10: { total: 10, r: 50, cols: [150, 356, 562, 768, 974], rows: [180, 320] },
};

function pos(L, i) { const per = L.cols.length; return { cx: L.cols[i % per], cy: L.rows[Math.floor(i / per)] }; }

// --- Marken-Hintergrund im CODE (Standard, ohne OpenAI) ---
// Dunkler Verlauf in Markenfarbe + Akzent-Glow + dezente 90s-Diagonalen + Logo-Wasserzeichen.
async function brandBackground(cfg) {
  const bg = cfg.colorBg || '#191510';
  const acc = cfg.accent || '#f83808';
  const dark = shade(bg, -0.45), mid = bg, glow = acc;
  const stripes = Array.from({ length: 14 }, (_, i) => {
    const x = -200 + i * 130;
    return `<rect x="${x}" y="-60" width="34" height="${SH + 120}" transform="rotate(18 ${x} 0)" fill="${acc}" opacity="0.05"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${shade(mid, 0.06)}"/><stop offset="60%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/>
      </linearGradient>
      <radialGradient id="gl" cx="86%" cy="22%" r="70%">
        <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/><stop offset="45%" stop-color="${glow}" stop-opacity="0.12"/><stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SW}" height="${SH}" fill="url(#bg)"/>
    ${stripes}
    <rect width="${SW}" height="${SH}" fill="url(#gl)"/>
  </svg>`;
  let base = await sharp(Buffer.from(svg)).png().toBuffer();
  // Logo als dezentes Wasserzeichen rechts
  if (cfg.logoPath && existsSync(cfg.logoPath)) {
    const WM = 360;
    const wm = await sharp(readFileSync(cfg.logoPath))
      .resize(WM, WM, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .composite([{ input: Buffer.from(`<svg width="${WM}" height="${WM}"><rect width="${WM}" height="${WM}" fill="#000" fill-opacity="0.20"/></svg>`), blend: 'dest-in' }])
      .png().toBuffer();
    base = await sharp(base).composite([{ input: wm, top: Math.round((SH - WM) / 2), left: SW - WM - 40, blend: 'over' }]).png().toBuffer();
  }
  return base;
}

// --- Hintergrund wählen: bgPath > OpenAI (nur wenn cfg.useAI) > Code-Design ---
async function generateBackground(cfg) {
  if (cfg.bgPath) return readFileSync(cfg.bgPath);
  if (!cfg.useAI) return await brandBackground(cfg);
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY fehlt in .env');
  const prompt = [
    `Elegant wide horizontal banner background for a loyalty stamp card of "${cfg.name}".`,
    `Brand style: ${cfg.vibe}.`,
    `Dominant color ${cfg.colorBg}${cfg.accent ? `, accent ${cfg.accent}` : ''}.`,
    `Abstract, premium, tasteful, soft depth and texture — NOT a flat color.`,
    `Absolutely NO text, NO letters, NO logos, NO circles, NO icons.`,
    `Keep the horizontal center band calm and uncluttered so UI elements can sit on top.`,
    `Cohesive, expensive, brand-forward — like a high-end Apple Wallet card.`,
  ].join(' ');
  console.log('  → gpt-image-2: generiere Marken-Hintergrund …');
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: cfg.quality || 'medium', n: 1 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('OpenAI-Bild-Fehler: ' + JSON.stringify(j.error || j));
  return Buffer.from(j.data[0].b64_json, 'base64');
}

// --- Hintergrund auf Strip-Maß bringen: 'contain' = NICHTS abschneiden (Ränder in Designfarbe) ---
async function bgToStrip(rawBuf, bg = '#101010') {
  return await sharp(rawBuf).resize(SW, SH, { fit: 'contain', position: 'centre', background: bg }).png().toBuffer();
}

// --- Stempel-Overlay (Titel + Slots + Haken) als SVG ---
function emptyCircle(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.10)" stroke="${WHITE}" stroke-width="4" stroke-opacity="0.95"/>`;
}
function checkMark(cx, cy, r, fill) {
  const k = r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${WHITE}" stroke-width="3" stroke-opacity="0.85"/>`
    + `<path d="M ${cx - 0.42 * k} ${cy + 0.04 * k} L ${cx - 0.12 * k} ${cy + 0.38 * k} L ${cx + 0.45 * k} ${cy - 0.36 * k}" `
    + `fill="none" stroke="${WHITE}" stroke-width="${r * 0.22}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
// Gemalter / gestempelter grüner Haken (wirkt handgemacht, verzeiht minimale Abweichung)
function paintedCheck(cx, cy, r, fill = '#3aa84a') {
  const k = r, rot = 0, dark = '#2c8038';
  const path = `M ${cx - 0.52 * k} ${cy + 0.02 * k} `
    + `C ${cx - 0.34 * k} ${cy + 0.18 * k}, ${cx - 0.22 * k} ${cy + 0.32 * k}, ${cx - 0.05 * k} ${cy + 0.46 * k} `
    + `C ${cx + 0.12 * k} ${cy + 0.18 * k}, ${cx + 0.36 * k} ${cy - 0.24 * k}, ${cx + 0.62 * k} ${cy - 0.54 * k}`;
  return `<g transform="rotate(${rot} ${cx} ${cy})">`
    + `<path d="${path}" fill="none" stroke="${dark}" stroke-width="${r * 0.5}" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`
    + `<path d="${path}" fill="none" stroke="${fill}" stroke-width="${r * 0.33}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `</g>`;
}
function overlaySvg(cfg, L, filled) {
  const rowsY = L.rows;
  const fill = cfg.fillColor || cfg.accent || GREEN;
  const bandTop = Math.min(...rowsY) - L.r - 50;
  const bandBot = Math.max(...rowsY) + L.r + 50;
  // Dezentes Glas-Band für Struktur (auf dunklem BG nur leicht)
  const band = `<rect x="56" y="${bandTop}" width="${SW - 112}" height="${bandBot - bandTop}" rx="36" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" stroke-width="1.5"/>`;
  const title = `<text x="78" y="${bandTop - 30}" font-family="${FONT}" font-size="31" font-weight="800" fill="${WHITE}" letter-spacing="5" filter="url(#sh)">SAMMLE ${L.total} STEMPEL</text>`;
  const reward = cfg.reward
    ? `<text x="${SW - 78}" y="${bandTop - 30}" text-anchor="end" font-family="${FONT}" font-size="25" font-weight="700" fill="${fill}" letter-spacing="1" filter="url(#sh)">${String(cfg.reward).toUpperCase()}</text>`
    : '';
  let s = '';
  for (let i = 0; i < L.total; i++) {
    const { cx, cy } = pos(L, i);
    s += (i < filled) ? checkMark(cx, cy, L.r, fill) : emptyCircle(cx, cy, L.r);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">`
    + `<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter>`
    + `<filter id="cs" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/></filter></defs>`
    + band + title + reward + `<g filter="url(#cs)">${s}</g></svg>`;
}

// --- Icon aus Logo (oder Markenquadrat) ---
async function makeIcon(cfg, size) {
  if (cfg.logoPath && existsSync(cfg.logoPath)) {
    const pad = Math.round(size * 0.12);
    const logo = await sharp(readFileSync(cfg.logoPath)).resize(size - 2 * pad, size - 2 * pad, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const bg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${cfg.colorBg}"/></svg>`;
    return await sharp(Buffer.from(bg)).composite([{ input: logo, top: pad, left: pad }]).png().toBuffer();
  }
  const initial = (cfg.name || 'F').trim()[0].toUpperCase();
  const svg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${cfg.colorBg}"/>`
    + `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="${FONT}" font-size="${size * 0.56}" font-weight="800" fill="${cfg.colorText || '#fff'}">${initial}</text></svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const argCfg = process.argv[2];
  const cfg = argCfg
    ? JSON.parse(readFileSync(argCfg, 'utf8'))
    : { slug: 'test-cafe-nero', name: 'Café Nero', goal: 5, colorBg: '#3b2419', colorText: '#f3e7d6',
        accent: '#c9a86a', vibe: 'cozy artisanal specialty coffee roastery, warm espresso tones, hand-crafted, inviting', reward: '1 Kaffee gratis' };
  cfg.goal = cfg.goal || 5;
  const L = LAYOUT[cfg.goal] || LAYOUT[5];
  const dir = join(process.cwd(), 'api', '_assets', `biz-${cfg.slug}-stamp${cfg.goal}`);
  mkdirSync(dir, { recursive: true });

  console.log(`\nGeneriere Assets für "${cfg.name}" (${cfg.goal}er) → ${dir}`);
  const raw = await generateBackground(cfg);
  writeFileSync(join(process.cwd(), `_raw-${cfg.slug}.png`), raw); // Roh-Bild zum Anschauen
  const stripBg = await bgToStrip(raw, cfg.colorBg || '#101010');

  // ALS-IS-Modus (komplett fertiges Design hochgeladen): Bild direkt als Strip für ALLE Stände,
  // KEINE eigenen Stempel drüberlegen. Stempelstand zeigt der Pass oben als Zahl.
  if (cfg.asIs) {
    for (const w of SIZES) {
      const out = w === SW ? stripBg : await sharp(stripBg).resize({ width: w }).png().toBuffer();
      for (let n = 0; n <= L.total; n++) writeFileSync(join(dir, `strip_${n}${SUF[w]}.png`), out);
      writeFileSync(join(dir, `strip${SUF[w]}.png`), out);
    }
    writeFileSync(join(dir, 'icon.png'), await makeIcon(cfg, 29));
    writeFileSync(join(dir, 'icon@2x.png'), await makeIcon(cfg, 58));
    writeFileSync(join(dir, 'icon@3x.png'), await makeIcon(cfg, 87));
    writeFileSync(join(process.cwd(), `_preview-${cfg.slug}.png`), readFileSync(join(dir, 'strip@3x.png')));
    console.log(`OK ✓ (als-is)  Vorschau: _preview-${cfg.slug}.png`);
    return;
  }

  // FÜLL-MODUS: Upload-Design als BG + nur grüne Haken auf den (vorhandenen) Kreisen für gefüllte Stempel.
  // Positionen als Fraktionen (Template NINI/Hilda); leere Stempel = das Design zeigt seine eigenen Kreise.
  if (cfg.fillOnly) {
    const xfr = cfg.stampXfr || (cfg.goal >= 10
      ? [0.175, 0.339, 0.501, 0.664, 0.823, 0.175, 0.339, 0.501, 0.664, 0.823]
      : [0.175, 0.339, 0.501, 0.664, 0.823]);
    const yfrArr = cfg.goal >= 10 ? [0.42, 0.42, 0.42, 0.42, 0.42, 0.78, 0.78, 0.78, 0.78, 0.78] : null;
    const yfr = cfg.stampYfr ?? 0.60;
    const r = Math.round((cfg.stampRfr ?? 0.085) * SW);
    // exakte Positionen pro Design (von mir abgelesen) > Fraktions-Defaults
    const positions = (cfg.stampPositions && cfg.stampPositions.length)
      ? cfg.stampPositions.map(p => ({ cx: Math.round(p.x * SW), cy: Math.round(p.y * SH) }))
      : xfr.map((fx, i) => ({ cx: Math.round(fx * SW), cy: Math.round((yfrArr ? yfrArr[i] : yfr) * SH) }));
    const draw = (n) => {
      let s = '';
      for (let i = 0; i < Math.min(n, positions.length); i++) s += paintedCheck(positions[i].cx, positions[i].cy, r);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><defs><filter id="cs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter></defs><g filter="url(#cs)">${s}</g></svg>`;
    };
    for (let n = 0; n <= L.total; n++) {
      const full = n === 0 ? stripBg : await sharp(stripBg).composite([{ input: Buffer.from(draw(n)) }]).png().toBuffer();
      for (const w of SIZES) {
        const out = w === SW ? full : await sharp(full).resize({ width: w }).png().toBuffer();
        writeFileSync(join(dir, `strip_${n}${SUF[w]}.png`), out);
        if (n === 0) writeFileSync(join(dir, `strip${SUF[w]}.png`), out);
      }
    }
    writeFileSync(join(dir, 'icon.png'), await makeIcon(cfg, 29));
    writeFileSync(join(dir, 'icon@2x.png'), await makeIcon(cfg, 58));
    writeFileSync(join(dir, 'icon@3x.png'), await makeIcon(cfg, 87));
    writeFileSync(join(process.cwd(), `_preview-${cfg.slug}.png`), readFileSync(join(dir, `strip_${Math.min(3, L.total)}@3x.png`)));
    console.log(`OK ✓ (fill-only)  Vorschau: _preview-${cfg.slug}.png (Stand ${Math.min(3, L.total)}/${L.total})`);
    return;
  }

  // Stände 0..goal in 3 Größen
  for (let n = 0; n <= L.total; n++) {
    const overlay = Buffer.from(overlaySvg(cfg, L, n));
    const full = await sharp(stripBg).composite([{ input: overlay }]).png().toBuffer(); // 1125x432
    for (const w of SIZES) {
      const out = w === SW ? full : await sharp(full).resize({ width: w }).png().toBuffer();
      writeFileSync(join(dir, `strip_${n}${SUF[w]}.png`), out);
    }
  }
  // Default-Strip (= Stand 0) unter dem Namen strip.png
  for (const w of SIZES) {
    const overlay = Buffer.from(overlaySvg(cfg, L, 0));
    const full = await sharp(stripBg).composite([{ input: overlay }]).png().toBuffer();
    const out = w === SW ? full : await sharp(full).resize({ width: w }).png().toBuffer();
    writeFileSync(join(dir, `strip${SUF[w]}.png`), out);
  }
  // Icons
  writeFileSync(join(dir, 'icon.png'), await makeIcon(cfg, 29));
  writeFileSync(join(dir, 'icon@2x.png'), await makeIcon(cfg, 58));
  writeFileSync(join(dir, 'icon@3x.png'), await makeIcon(cfg, 87));

  // Vorschau (Stand 2/5) ins Projektroot zum Anschauen
  const prevN = Math.min(2, L.total);
  writeFileSync(join(process.cwd(), `_preview-${cfg.slug}.png`), readFileSync(join(dir, `strip_${prevN}@3x.png`)));
  console.log(`OK ✓  Vorschau: _preview-${cfg.slug}.png  (Stand ${prevN}/${L.total})`);
  console.log(`Roh-Hintergrund: _raw-${cfg.slug}.png`);
}

main().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });

// Geteilte Theme-/Asset-Logik für pass.mjs (Erstausgabe) und v1.mjs (Live-Update).
// Eine Quelle der Wahrheit, damit beide Pfade nie auseinanderdriften.
//
// Regeln:
//  - Lila (slug 'lila-wiesbaden')          -> exakt wie immer (eigene Designs, feste Farben).
//  - Betrieb MIT eigenem Design-Ordner      -> api/_assets/biz-<slug>-{stamp5|stamp10|coupon}
//                                              nutzt diesen + seine Markenfarben (color_bg/color_text).
//  - alle anderen                            -> neutrale default-Assets + Betriebsfarbe.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Bundling-fest: je nach Deploy-/Bundle-Layout liegt _assets woanders -> ersten existierenden Pfad nehmen.
const CANDIDATES = [
  join(__dirname, '..', 'api', '_assets'),
  join(process.cwd(), 'api', '_assets'),
  join(__dirname, '_assets'),
  join(__dirname, 'api', '_assets'),
];
export const ASSETS = CANDIDATES.find(existsSync) || CANDIDATES[0];

const LILA_SLUG = 'lila-wiesbaden';
const LILA_BG = 'rgb(184, 165, 220)';

export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Eigener Marken-Ordner vorhanden? -> Prefix 'biz-<slug>-', sonst null.
function customPrefix(slug) {
  if (!slug) return null;
  const p = `biz-${slug}-`;
  return ['stamp5', 'stamp10', 'coupon'].some(k => existsSync(join(ASSETS, p + k))) ? p : null;
}

export function themeFor(biz) {
  if (biz && biz.slug === LILA_SLUG) {
    return { prefix: '', org: 'Lila Wiesbaden', bg: LILA_BG, fg: 'rgb(61,42,115)', label: 'rgb(90,65,140)', isDefault: false, custom: false };
  }
  const custom = customPrefix(biz && biz.slug);
  return {
    prefix: custom || 'default-',
    org: (biz && biz.name) || 'FlowState',
    bg: hexToRgb(biz && biz.color_bg) || 'rgb(107,92,255)',
    fg: hexToRgb(biz && biz.color_text) || 'rgb(255,255,255)',
    label: custom ? 'rgb(225,225,225)' : 'rgb(232,232,248)',
    isDefault: !custom,
    custom: !!custom,
  };
}

export function assetKey(type, goal, prefix = '') {
  return prefix + (type === 'stampcard' ? (goal >= 10 ? 'stamp10' : 'stamp5') : 'coupon');
}

// Eigenes Design PRO AKTION (Phase: Fitness First). Ordner `biz-<slug>-c<8>` falls vorhanden,
// sonst null -> Fallback auf die mechanik-gekoppelten Assets (assetKey).
export function campaignDir(slug, campId) {
  if (!slug || !campId) return null;
  const dir = `biz-${slug}-c${String(campId).replace(/-/g, '').slice(0, 8)}`;
  return existsSync(join(ASSETS, dir)) ? dir : null;
}

// Fehlt der Custom-Ordner für einen Typ (z.B. nur stamp5 generiert, aber coupon angefragt),
// fällt es sauber auf die default-Assets zurück, statt zu crashen.
function resolveDir(key) {
  if (existsSync(join(ASSETS, key))) return key;
  const base = key.replace(/^biz-[a-z0-9-]+?-(stamp5|stamp10|coupon)$/, '$1');
  if (base !== key && existsSync(join(ASSETS, 'default-' + base))) return 'default-' + base;
  return key;
}

export function loadAssets(key, stripName = 'strip') {
  const dir = resolveDir(key);
  const f = (n) => readFileSync(join(ASSETS, dir, n));
  return {
    'icon.png': f('icon.png'), 'icon@2x.png': f('icon@2x.png'), 'icon@3x.png': f('icon@3x.png'),
    'strip.png': f(`${stripName}.png`), 'strip@2x.png': f(`${stripName}@2x.png`), 'strip@3x.png': f(`${stripName}@3x.png`),
  };
}

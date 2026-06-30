// Geteilte Theme-/Asset-Logik für pass.mjs (Erstausgabe) und v1.mjs (Live-Update) + card-image.mjs.
// Eine Quelle der Wahrheit, damit alle Pfade nie auseinanderdriften.
//
// SKALIERUNG: Pro-Betrieb-Designs (biz-*) liegen NICHT mehr im Code-Bündel (250-MB-Limit),
// sondern im Supabase-Storage-Bucket `card-assets`. Ein kleines `manifest.json` (gebündelt)
// sagt, welche biz-Ordner existieren; die Bytes werden zur Laufzeit aus Storage geladen (gecacht).
// Standard-/Lila-Designs bleiben lokal gebündelt (klein, schneller Pfad).
//
// Regeln:
//  - Lila (slug 'lila-wiesbaden')      -> exakt wie immer (eigene Designs, feste Farben).
//  - Betrieb MIT eigenem Design        -> biz-<slug>-{stamp5|stamp10|coupon} (lokal ODER Storage).
//  - alle anderen                       -> neutrale default-Assets + Betriebsfarbe.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Bundling-fest: je nach Deploy-/Bundle-Layout liegt _assets woanders -> ersten existierenden Pfad nehmen.
const CANDIDATES = [
  join(__dirname, '..', 'api', '_assets'),
  join(process.cwd(), 'api', '_assets'),
  join(__dirname, '_assets'),
  join(__dirname, 'api', '_assets'),
];
export const ASSETS = CANDIDATES.find(existsSync) || CANDIDATES[0];

// --- Manifest: welche biz-* Design-Ordner liegen im Storage? ---
let MANIFEST_SET = new Set();
let BUCKET = 'card-assets';
try {
  const m = JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'));
  MANIFEST_SET = new Set(m.dirs || []);
  if (m.storageBucket) BUCKET = m.storageBucket;
} catch {}

// Ordner vorhanden? Lokal gebündelt (Standard/Lila) ODER laut Manifest im Storage (biz-*).
function dirExists(dir) {
  return existsSync(join(ASSETS, dir)) || MANIFEST_SET.has(dir);
}

// Lazy Supabase-Client (nur zum Nachladen der Storage-Assets).
let _db = null;
function db() {
  if (!_db) _db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  return _db;
}

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
  return ['stamp5', 'stamp10', 'coupon'].some(k => dirExists(p + k)) ? p : null;
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

// Eigenes Design PRO AKTION. Ordner `biz-<slug>-c<8>` falls vorhanden, sonst null.
export function campaignDir(slug, campId) {
  if (!slug || !campId) return null;
  const dir = `biz-${slug}-c${String(campId).replace(/-/g, '').slice(0, 8)}`;
  return dirExists(dir) ? dir : null;
}

// Fehlt der Custom-Ordner für einen Typ, sauber auf default- zurückfallen.
function resolveDir(key) {
  if (dirExists(key)) return key;
  const base = key.replace(/^biz-[a-z0-9-]+?-(stamp5|stamp10|coupon)$/, '$1');
  if (base !== key && dirExists('default-' + base)) return 'default-' + base;
  return key;
}

// Ein einzelnes Asset laden: lokal gebündelt ODER aus Storage.
async function loadOne(dir, name) {
  const local = join(ASSETS, dir, name);
  if (existsSync(local)) return readFileSync(local);
  const { data, error } = await db().storage.from(BUCKET).download(`${dir}/${name}`);
  if (error || !data) throw new Error(`Asset fehlt: ${dir}/${name}${error ? ' — ' + error.message : ''}`);
  return Buffer.from(await data.arrayBuffer());
}

// Gecachte Asset-Buffer pro dir+stripName (warmer Container spart Storage-Reads).
const _assetCache = new Map();
export async function loadAssets(key, stripName = 'strip') {
  const dir = resolveDir(key);
  const ck = dir + '|' + stripName;
  const cached = _assetCache.get(ck);
  if (cached) return cached;
  const [icon, icon2, icon3, strip, strip2, strip3] = await Promise.all([
    loadOne(dir, 'icon.png'), loadOne(dir, 'icon@2x.png'), loadOne(dir, 'icon@3x.png'),
    loadOne(dir, `${stripName}.png`), loadOne(dir, `${stripName}@2x.png`), loadOne(dir, `${stripName}@3x.png`),
  ]);
  const out = {
    'icon.png': icon, 'icon@2x.png': icon2, 'icon@3x.png': icon3,
    'strip.png': strip, 'strip@2x.png': strip2, 'strip@3x.png': strip3,
  };
  _assetCache.set(ck, out);
  return out;
}

// Zentrales Pass-Generierungs-Modul (passkit-generator, pure JS -> serverless-tauglich).
// Erzeugt signierte .pkpass-Buffer für Gutschein + Stempelkarte.
// Zertifikate kommen aus ENV (base64) ODER lokal aus certs/.
import { PKPass } from 'passkit-generator';
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PASS_TYPE_ID = 'pass.com.lila.gutschein';
const TEAM_ID = '4X4Z2XA87V';
const LILA = 'rgb(184, 165, 220)';
const LILAHEX = '#b8a5dc';

// --- Zertifikate laden (ENV base64 bevorzugt, sonst lokale Dateien) ---
function loadCerts() {
  const fromEnv = (name) => process.env[name] ? Buffer.from(process.env[name], 'base64') : null;
  const signerCert = fromEnv('APPLE_PASS_CERT_B64');
  const signerKey  = fromEnv('APPLE_PASS_KEY_B64');
  const wwdr       = fromEnv('APPLE_WWDR_B64');
  if (signerCert && signerKey && wwdr) return { signerCert, signerKey, wwdr };
  // lokal
  const C = (f) => readFileSync(join(process.cwd(), 'certs', f));
  return { signerCert: C('pass.pem'), signerKey: C('pass.key'), wwdr: C('wwdr.pem') };
}

// --- Icon (Pflicht) generieren ---
async function iconBuf(size) {
  const svg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size*0.2}" fill="${LILA}"/><text x="50%" y="63%" font-family="Georgia,serif" font-size="${size*0.5}" font-weight="700" fill="#3d2a73" text-anchor="middle">l.</text></svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

// --- Strip aus Design-PNG: 1125x432 + Fade unten in Lila ---
async function stripBuf(designBuf, width) {
  const SW = 1125, SH = 432;
  const base = await sharp(designBuf).resize(SW, SH, { fit: 'cover' }).toBuffer();
  const fadeH = 80;
  const fade = Buffer.from(`<svg width="${SW}" height="${SH}"><defs><linearGradient id="f" x1="0" y1="${SH-fadeH}" x2="0" y2="${SH}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${LILAHEX}" stop-opacity="0"/><stop offset="1" stop-color="${LILAHEX}" stop-opacity="1"/></linearGradient></defs><rect x="0" y="${SH-fadeH}" width="${SW}" height="${fadeH}" fill="url(#f)"/></svg>`);
  const faded = await sharp(base).composite([{ input: fade, top: 0, left: 0 }]).png().toBuffer();
  return await sharp(faded).resize({ width }).png().toBuffer();
}

/**
 * Erzeugt einen signierten .pkpass-Buffer.
 * @param {Object} opts
 * @param {Buffer} opts.designBuf - Querformat-Design-PNG (2.6:1)
 * @param {string} opts.serial - Seriennummer / Code
 * @param {string} opts.type - 'coupon' | 'stampcard'
 * @param {Object} opts.data - { title, value, validUntil, stampGoal, stamps, reward, business }
 */
export async function generatePass({ designBuf, serial, type, data = {} }) {
  const certs = loadCerts();

  const [icon, icon2, icon3, strip, strip2, strip3] = await Promise.all([
    iconBuf(29), iconBuf(58), iconBuf(87),
    stripBuf(designBuf, 375), stripBuf(designBuf, 750), stripBuf(designBuf, 1125),
  ]);

  const isStamp = type === 'stampcard';
  const passStructure = isStamp
    ? {
        headerFields: [{ key: 'count', label: 'STEMPEL', value: `${data.stamps ?? 0}/${data.stampGoal ?? 10}` }],
        secondaryFields: [{ key: 'reward', label: 'BELOHNUNG', value: data.reward || 'Dein Lieblingsdrink' }],
      }
    : {
        primaryFields: [],
        secondaryFields: [
          ...(data.value ? [{ key: 'value', label: 'WERT', value: data.value }] : []),
          ...(data.validUntil ? [{ key: 'valid', label: 'GÜLTIG BIS', value: data.validUntil }] : []),
        ],
      };

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    teamIdentifier: TEAM_ID,
    organizationName: data.business || 'Lila Wiesbaden',
    description: data.title || 'lila.',
    serialNumber: serial,
    foregroundColor: 'rgb(61,42,115)',
    labelColor: 'rgb(90,65,140)',
    backgroundColor: LILA,
    [isStamp ? 'storeCard' : 'coupon']: passStructure,
    barcodes: [{ format: 'PKBarcodeFormatQR', message: serial, messageEncoding: 'iso-8859-1', altText: serial }],
  };

  const pass = new PKPass({
    'pass.json': Buffer.from(JSON.stringify(passJson)),
    'icon.png': icon, 'icon@2x.png': icon2, 'icon@3x.png': icon3,
    'strip.png': strip, 'strip@2x.png': strip2, 'strip@3x.png': strip3,
  }, certs);

  return pass.getAsBuffer();
}

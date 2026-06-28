// Baut Google-Wallet GenericClass/Object aus einer Karte.
// Nutzt cardView() (lib/passview.mjs) -> Apple & Google zeigen dieselben Felder, nie Divergenz.
import { cardView } from './passview.mjs';

const issuer = () => process.env.GOOGLE_WALLET_ISSUER_ID || '';

export function rgbToHex(rgb) {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(rgb || '');
  if (!m) return '#6b5cff';
  const h = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
}

export function classId(slug) {
  const s = (slug || 'default').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'default';
  return `${issuer()}.fs-${s}`;
}
export function objectId(serial) {
  return `${issuer()}.${String(serial).replace(/[^A-Za-z0-9_.-]/g, '')}`;
}

// Apple-Felder (header/primary/secondary/auxiliary) -> Google textModulesData.
function fieldRows(view) {
  const st = view.structure || {};
  const all = [
    ...(st.headerFields || []),
    ...(st.primaryFields || []),
    ...(st.secondaryFields || []),
    ...(st.auxiliaryFields || []),
  ].filter(f => f && f.value !== undefined && f.value !== null && String(f.value) !== '');
  return all.map((f, i) => ({ id: `row${i}`, header: String(f.label || ''), body: String(f.value) }));
}

export function buildGoogleCard({ camp, pass, theme, slug, serial, org, heroUrl, logoUrl }) {
  const view = cardView(camp, pass || {}, theme || {}, { nowMs: Date.now(), startMs: (pass && pass.startMs) || null });
  const cid = classId(slug);
  const oid = objectId(serial);
  const name = org || (theme && theme.org) || 'FlowState';

  const classObj = {
    id: cid,
    issuerName: name,
    reviewStatus: 'UNDER_REVIEW',
  };

  const object = {
    id: oid,
    classId: cid,
    state: 'ACTIVE',
    cardTitle: { defaultValue: { language: 'de', value: name } },
    header: { defaultValue: { language: 'de', value: camp.title || 'Karte' } },
    hexBackgroundColor: rgbToHex(theme && theme.bg),
    textModulesData: fieldRows(view),
    barcode: { type: 'QR_CODE', value: String(serial), alternateText: String(serial) },
    ...(logoUrl ? { logo: { sourceUri: { uri: logoUrl } } } : {}),
    ...(heroUrl ? { heroImage: { sourceUri: { uri: heroUrl } } } : {}),
  };

  return { classObj, object, cid, oid };
}

// Nur die volatilen Felder fürs Live-Update (Stempelzahl/Stand; Hero nur wenn neu gerendert).
export function googlePatchFor({ camp, pass, theme, serial, org, heroUrl }) {
  const view = cardView(camp, pass || {}, theme || {}, { nowMs: Date.now(), startMs: (pass && pass.startMs) || null });
  return {
    textModulesData: fieldRows(view),
    ...(heroUrl ? { heroImage: { sourceUri: { uri: heroUrl } } } : {}),
  };
}

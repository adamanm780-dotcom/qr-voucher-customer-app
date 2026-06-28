// Geteilte Mint-Logik für Apple (api/pass.mjs) UND Google (api/card.mjs).
// Eine Quelle der Wahrheit: Kampagne laden, Drossel, Theme, passes-Zeile anlegen.
import crypto from 'crypto';
import { themeFor, assetKey, campaignDir } from './theme.mjs';
import { campaignMintAllowed } from './security.mjs';
import { initialRemaining } from './cards.mjs';

// ISO -> "DD.MM.YYYY" (Gültig-bis). Leer bei ungültig.
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function serialPrefix(slug) {
  return (slug || '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'FS';
}
export function newSerial(slug) {
  return serialPrefix(slug) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// PURE: Pass-data-Felder + initialer Restzähler. Identisch zu pass.mjs (Bestandsverhalten).
export function mintData(camp, theme, authToken) {
  const type = camp.type;
  const config = camp.config || {};
  const remaining = initialRemaining(type, config);
  let validUntil = config.valid_until ? fmtDate(config.valid_until) : null;
  if (type === 'coupon' && !validUntil) validUntil = '31.12.2026';
  const data = {
    title: camp.title, authToken, ...theme,
    stampGoal: camp.stamp_goal, stamps: 0,
    reward: camp.reward, value: camp.value,
    remaining, config, validUntil,
    startMs: null,
  };
  return { remaining, data };
}

// Kampagne per id ODER enroll_token laden, Drossel anwenden, passes-Zeile anlegen.
export async function mintCard(db, { campaign, enroll }) {
  const q = enroll
    ? db.from('campaigns').select('*').eq('enroll_token', enroll).single()
    : db.from('campaigns').select('*').eq('id', campaign).single();
  const { data: camp, error } = await q;
  if (error || !camp) return { ok: false, status: 404, error: 'Kampagne nicht gefunden' };

  if (!(await campaignMintAllowed(db, camp.id))) {
    return { ok: false, status: 429, error: 'Zu viele Anfragen. Bitte später erneut versuchen.' };
  }

  const { data: biz } = await db.from('businesses')
    .select('name,slug,color_bg,color_text,logo_url')
    .eq('id', camp.business_id).maybeSingle();
  const theme = themeFor(biz);
  const type = camp.type;
  const key = campaignDir(biz?.slug, camp.id) || assetKey(type, camp.stamp_goal, theme.prefix);
  const serial = newSerial(biz?.slug);
  const authToken = crypto.randomBytes(16).toString('hex');
  const { remaining, data } = mintData(camp, theme, authToken);

  const { error: insErr } = await db.from('passes').insert({
    campaign_id: camp.id, business_id: camp.business_id, serial,
    auth_token: authToken, stamps: 0, status: 'active',
    ...(remaining != null ? { remaining } : {}),
  });
  if (insErr) return { ok: false, status: 500, error: 'Karte konnte nicht angelegt werden' };

  return { ok: true, camp, biz, theme, slug: biz?.slug || null, serial, authToken, type, key, data, remaining };
}

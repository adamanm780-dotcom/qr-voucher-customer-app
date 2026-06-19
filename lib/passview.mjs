// EINZIGE QUELLE für das Pass-Layout (Felder + welcher Strip) je Mechanik.
// pass.mjs (Erstausgabe) UND v1.mjs (Live-Update) nutzen das -> keine Divergenz mehr.
//
// cardView(camp, pass, theme, opts) -> { style:'storeCard'|'coupon', structure, stripName, expired }
//   camp:  { type, config, stamp_goal, reward, value, title }
//   pass:  { stamps, remaining }            (bei Erstausgabe: stamps:0, remaining:Startwert)
//   theme: { isDefault }                    (für Default-Wert-Anzeige bei Gutschein)
//   opts:  { startMs|null, nowMs }          (startMs = erster 'entry' für Zeit-Pass)

const DAY = 86400000;
function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms); if (isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function cardView(camp, pass = {}, theme = {}, opts = {}) {
  const t = camp.type, cfg = camp.config || {}, nowMs = opts.nowMs || 0;
  const goal = camp.stamp_goal || 10;

  if (t === 'stampcard') {
    const filled = Math.max(0, Math.min(pass.stamps || 0, goal));
    return { style: 'storeCard', stripName: `strip_${filled}`, expired: false, structure: {
      headerFields: [{ key: 'count', label: 'STEMPEL', value: `${pass.stamps || 0}/${goal}` }],
      secondaryFields: [{ key: 'reward', label: 'BELOHNUNG', value: camp.reward || 'Dein Lieblingsdrink' }],
    } };
  }
  if (t === 'multipass') {
    return { style: 'storeCard', stripName: 'strip', expired: false, structure: {
      headerFields: [{ key: 'count', label: 'ÜBRIG', value: `${pass.remaining ?? 0}×` }],
      secondaryFields: [{ key: 'reward', label: 'EINLÖSBAR', value: camp.reward || camp.title || '1 Einlösung' }],
    } };
  }
  if (t === 'balance') {
    const unit = cfg.unit || '€';
    return { style: 'storeCard', stripName: 'strip', expired: false, structure: {
      headerFields: [{ key: 'count', label: 'GUTHABEN', value: `${pass.remaining ?? 0} ${unit}` }],
      secondaryFields: camp.reward ? [{ key: 'reward', label: 'EINLÖSBAR FÜR', value: camp.reward }] : [],
    } };
  }
  // ZEIT-PASS: access mit config.tage -> gültig ab erstem Scan für N Tage, "TAG X/N".
  if (t === 'access' && cfg.tage) {
    const N = cfg.tage;
    if (opts.startMs) {
      const dayNum = Math.min(N, Math.floor((nowMs - opts.startMs) / DAY) + 1);   // verstrichene Tage = rote Kreuze
      const untilMs = opts.startMs + N * DAY;
      return { style: 'storeCard', stripName: `strip_${dayNum}`, expired: nowMs > untilMs, structure: {
        headerFields: [{ key: 'count', label: 'TAG', value: `${dayNum}/${N}` }],
        secondaryFields: [{ key: 'valid', label: 'GÜLTIG BIS', value: fmtDate(untilMs) }],
      } };
    }
    // Noch nicht gestartet (frisch in Wallet) -> leere Boxen
    return { style: 'storeCard', stripName: 'strip_0', expired: false, structure: {
      headerFields: [{ key: 'count', label: 'TAG', value: `0/${N}` }],
      secondaryFields: [{ key: 'valid', label: 'STARTET MIT', value: '1. Scan' }],
    } };
  }
  // coupon / access (ohne tage, feste Daten)
  const validUntil = cfg.valid_until ? fmtDate(Date.parse(cfg.valid_until)) : (t === 'coupon' ? '31.12.2026' : '');
  return { style: 'coupon', stripName: 'strip', expired: false, structure: {
    primaryFields: [],
    secondaryFields: [
      ...(theme.isDefault && camp.value ? [{ key: 'value', label: 'WERT', value: camp.value }] : []),
      ...(validUntil ? [{ key: 'valid', label: 'GÜLTIG BIS', value: validUntil }] : []),
    ],
  } };
}

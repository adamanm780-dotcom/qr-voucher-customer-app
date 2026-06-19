// Phase 2 — EINZIGE QUELLE DER WAHRHEIT für Karten-MECHANIKEN (serverseitig).
// pass.mjs / redeem.mjs / card-image.mjs importieren von hier.
// Die vielen "Kartentypen" aus dem Pitch (Mitarbeiterbenefit, Essensgutschein, Zugangspass …)
// sind Templates ÜBER diesen 5 Mechaniken (Phase 4) — NICHT je eine eigene Mechanik.
//
// Hinweis: Das Betriebs-Dashboard (public/dashboard.html) spiegelt diese Liste clientseitig
// (kein Build-Step / kein Import aus lib/ über HTTP) -> bei Änderungen BEIDE Stellen pflegen.

export const MECHANICS = {
  // bestehend
  stampcard: { label: 'Stempelkarte', desc: 'Sammeln bis Ziel → Belohnung', action: 'stamp',  counter: 'stamps' },
  coupon:    { label: 'Gutschein',    desc: 'Einmal einlösen / entwerten',  action: 'redeem', counter: null },
  // neu (Phase 2)
  multipass: { label: 'Mehrfachkarte', desc: 'N Einlösungen, jede −1',       action: 'use',   counter: 'remaining' },
  balance:   { label: 'Guthaben',      desc: 'Betrag pro Scan abziehen',     action: 'debit', counter: 'remaining' },
  access:    { label: 'Zugangspass',   desc: 'Gültig im Zeitfenster',        action: 'entry', counter: null },
};

export const MECHANIC_KEYS = Object.keys(MECHANICS);
export const isMechanic = (t) => MECHANIC_KEYS.includes(t);
export const mechanicLabel = (t) => (MECHANICS[t] || MECHANICS.coupon).label;

// Startwert des Restzählers (passes.remaining) beim AUSGEBEN einer Karte.
// multipass: Anzahl erlaubter Einlösungen; balance: Startbetrag; sonst: null (nicht genutzt).
export function initialRemaining(type, config = {}) {
  if (type === 'multipass') { const n = parseInt(config.max_uses, 10); return Number.isFinite(n) && n > 0 ? n : null; }
  if (type === 'balance')   { const a = Number(config.start_amount);   return Number.isFinite(a) && a > 0 ? a : 0; }
  return null;
}

// Gültigkeitsfenster (access / optional für alle): { valid_from?, valid_until? } als ISO-Strings.
// Gibt true zurück, wenn die Karte JETZT gültig ist (kein Fenster = immer gültig).
export function withinValidity(config = {}, nowMs = Date.now()) {
  const from = config.valid_from ? Date.parse(config.valid_from) : null;
  const until = config.valid_until ? Date.parse(config.valid_until) : null;
  if (from && nowMs < from) return false;
  if (until && nowMs > until) return false;
  return true;
}

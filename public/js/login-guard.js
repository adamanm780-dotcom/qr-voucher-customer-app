// Clientseitige Anmelde-Sperre (pro Browser/Gerät).
// Regel (Wunsch FlowState): 3 Fehlversuche -> 5 Minuten gesperrt. Danach EIN weiterer
// Versuch; ist auch der falsch -> dauerhaft gesperrt, Nutzer muss FlowState anrufen.
// Erfolgreicher Login setzt alles zurück.
//
// Hinweis: rein clientseitig (der Login läuft direkt gegen Supabase Auth). Das ist die
// sichtbare Bremse am Formular; Supabase hat zusätzlich eine eigene serverseitige
// Auth-Drossel als Backstop.

const KEY = 'fs_login_guard';
const MAX_BEFORE_LOCK = 3;          // Fehlversuche bis zur 5-Min-Sperre
const LOCK_MS = 5 * 60 * 1000;      // Sperrdauer
const HARD_MS = 30 * 60 * 1000;     // "Anrufen"-Block erholt sich nach 30 Min selbst -> sperrt NIEMANDEN dauerhaft aus

export const SUPPORT_PHONE = '0176 45289172';
export const SUPPORT_TEL = '+4917645289172';

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

// Aktueller Sperr-Status: { allowed, blocked: 'lock'|'hard'|null, retryMs? }
export function loginGuardStatus() {
  const s = load();
  if (s.hardUntil) {
    if (Date.now() < s.hardUntil) return { allowed: false, blocked: 'hard', retryMs: s.hardUntil - Date.now() };
    try { localStorage.removeItem(KEY); } catch {}   // Block abgelaufen -> kompletter Neustart, Gerät wieder frei
    return { allowed: true, blocked: null };
  }
  if (s.lockUntil && Date.now() < s.lockUntil) return { allowed: false, blocked: 'lock', retryMs: s.lockUntil - Date.now() };
  return { allowed: true, blocked: null };
}

// Nach einem FEHLGESCHLAGENEN Versuch aufrufen. Gibt den neuen Status zurück.
export function recordLoginFail() {
  const s = load();
  // Schon 3 Fehlversuche gehabt (Sperre war abgelaufen) und es kommt ein weiterer -> Hard-Block (auto-Reset nach 30 Min).
  if ((s.fails || 0) >= MAX_BEFORE_LOCK) { s.hardUntil = Date.now() + HARD_MS; save(s); return loginGuardStatus(); }
  s.fails = (s.fails || 0) + 1;
  if (s.fails >= MAX_BEFORE_LOCK) s.lockUntil = Date.now() + LOCK_MS;
  save(s);
  return loginGuardStatus();
}

// Nach ERFOLGREICHEM Login aufrufen.
export function recordLoginSuccess() { try { localStorage.removeItem(KEY); } catch {} }

// Anzeigetext für eine Sperre (für 'lock' inkl. Restzeit-Countdown).
export function blockText(status) {
  if (status.blocked === 'hard') return `Zu viele Fehlversuche. Bitte ruf uns an: ${SUPPORT_PHONE}`;
  if (status.blocked === 'lock') {
    const total = Math.ceil((status.retryMs || 0) / 1000);
    const m = Math.floor(total / 60), s = total % 60;
    const t = m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s} Sek`;
    return `Zu viele Fehlversuche. Bitte in ${t} erneut versuchen.`;
  }
  return '';
}

// Verkabelt die Sperre mit der UI: deaktiviert den Button + zeigt Text, startet bei
// 'lock' einen Sekunden-Countdown und gibt das Formular nach Ablauf wieder frei.
// setText(text, blocked) wird von der Seite gestellt (eigenes Styling).
// Rückgabe: { render(), allowed() } — allowed() vor jedem Versuch prüfen.
export function bindLoginGuard(btnEl, setText) {
  let timer = null;
  function render() {
    const st = loginGuardStatus();
    if (st.blocked) {
      if (btnEl) btnEl.disabled = true;
      setText(blockText(st), st.blocked);
      if (st.blocked === 'lock') { if (!timer) timer = setInterval(render, 1000); }
      else if (timer) { clearInterval(timer); timer = null; }
      return false;
    }
    if (btnEl) btnEl.disabled = false;
    if (timer) { clearInterval(timer); timer = null; }
    return true;
  }
  render();
  return { render, allowed: () => loginGuardStatus().allowed };
}

// Vercel Serverless: Entwertung / Stempeln.
// POST /api/redeem  { serial: "LILA-XXXXXX", business_id?: "<uuid>" }
//  - Gutschein (campaign.type=coupon): Pass -> status 'redeemed' (einmalig). Zweiter Scan -> Fehler.
//  - Stempelkarte (stampcard): stamps +1. Bei stamps>=stamp_goal -> 'completed' (Belohnung frei) + reset auf 0.
// Antwort: { ok, action, message, pass:{serial,stamps,goal,status} }
import { createClient } from '@supabase/supabase-js';
import { notifyWallets } from '../lib/walletpush.mjs';
import { setCors } from '../lib/security.mjs';
import { withinValidity, mechanicLabel, MECHANICS } from '../lib/cards.mjs';

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
}

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Nur POST' });

  try {
    const { serial, redeemReward, amount, inspect } = await readBody(req);
    if (!serial) return res.status(400).json({ ok: false, message: 'serial fehlt' });

    const db = supa();

    // SICHERHEIT: nur der eingeloggte Betrieb darf SEINE eigenen Karten entwerten.
    const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return res.status(401).json({ ok: false, message: 'Nicht angemeldet.' });
    const { data: au, error: aErr } = await db.auth.getUser(jwt);
    if (aErr || !au?.user) return res.status(401).json({ ok: false, message: 'Sitzung ungültig — neu anmelden.' });
    const { data: myBiz } = await db.from('businesses').select('id').eq('owner_id', au.user.id);
    const ownedIds = new Set((myBiz || []).map(b => b.id));
    if (!ownedIds.size) return res.status(403).json({ ok: false, message: 'Kein Betrieb mit diesem Login.' });

    // Pass laden + zugehörige Kampagne
    const { data: pass, error: pErr } = await db.from('passes').select('*').eq('serial', serial).single();
    if (pErr || !pass) return res.status(404).json({ ok: false, message: 'Karte nicht gefunden: ' + serial });

    // Gehört die Karte zu DIESEM Betrieb? Sonst Ablehnung (kein Cross-Tenant-Entwerten).
    if (!ownedIds.has(pass.business_id)) {
      return res.status(403).json({ ok: false, action: 'foreign', message: 'Diese Karte gehört zu einem anderen Betrieb.' });
    }

    const { data: camp } = await db.from('campaigns').select('*').eq('id', pass.campaign_id).single();
    if (!camp) return res.status(404).json({ ok: false, message: 'Kampagne nicht gefunden' });

    const nowIso = () => new Date().toISOString();
    const touchPass = (fields) => db.from('passes').update({ ...fields, updated_at: nowIso() }).eq('id', pass.id);

    const fmtD = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
    const firstEntryMs = async () => { const { data: f } = await db.from('redemptions').select('created_at').eq('pass_id', pass.id).eq('action', 'entry').order('created_at', { ascending: true }).limit(1).maybeSingle(); return f ? Date.parse(f.created_at) : null; };

    // ---- INSPECT: Karte nur LESEN (keine Mutation) -> Scanner zeigt Vorschau vor dem Bestätigen ----
    if (inspect) {
      const { data: bz } = await db.from('businesses').select('name').eq('id', pass.business_id).maybeSingle();
      const cfg = camp.config || {};
      const t = camp.type;
      let valid = withinValidity(cfg, Date.now());
      let validUntil = fmtD(cfg.valid_until), dayInfo = null;
      // Zeit-Pass: Fenster ab ERSTEM Scan; vorher leer & „startet mit 1. Scan"
      if (t === 'access' && cfg.tage) {
        const startMs = await firstEntryMs();
        if (startMs) {
          const untilMs = startMs + cfg.tage * 86400000;
          valid = Date.now() <= untilMs; validUntil = fmtD(untilMs);
          dayInfo = `Tag ${Math.min(cfg.tage, Math.floor((Date.now() - startMs) / 86400000) + 1)}/${cfg.tage}`;
        } else { valid = true; dayInfo = `Startet mit 1. Scan (${cfg.tage} Tage)`; }
      }
      let usable = true, reason = '';
      if (t === 'coupon') { if (pass.status === 'redeemed') { usable = false; reason = 'Gutschein bereits eingelöst.'; } }
      else if (t === 'access') {
        if (cfg.tage) { if (!valid) { usable = false; reason = 'Zeit-Pass abgelaufen.'; } }
        else if (pass.status === 'redeemed') { usable = false; reason = 'Zugang bereits genutzt.'; }
        else if (!valid) { usable = false; reason = 'Abgelaufen oder noch nicht gültig.'; }
      } else if (t === 'multipass' || t === 'balance') {
        if (!(Number(pass.remaining) > 0)) { usable = false; reason = 'Karte ist aufgebraucht.'; }
      }
      const full = t === 'stampcard' && (pass.stamps || 0) >= (camp.stamp_goal || 10);
      return res.status(200).json({
        ok: true, inspect: true,
        card: {
          serial, type: t, label: mechanicLabel(t), title: camp.title, business: bz?.name || '',
          status: pass.status, remaining: pass.remaining, unit: cfg.unit || '€',
          stamps: pass.stamps || 0, goal: camp.stamp_goal || 0, full,
          reward: camp.reward || null, value: camp.value || null,
          validUntil, dayInfo, valid,
          needsAmount: t === 'balance', action: (MECHANICS[t] || {}).action || 'redeem',
          usable, reason,
        },
      });
    }

    // ---- MEHRFACHKARTE (multipass): jede Einlösung −1, bei 0 erschöpft ----
    if (camp.type === 'multipass') {
      const left = Number(pass.remaining);
      if (!Number.isFinite(left) || left <= 0) {
        return res.status(409).json({ ok: false, action: 'depleted', message: 'Karte ist aufgebraucht.', pass: { serial, remaining: 0, status: 'depleted' } });
      }
      const next = left - 1;
      await touchPass({ remaining: next, ...(next <= 0 ? { status: 'depleted' } : {}) });
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'use', note: `${next} übrig` });
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
      return res.status(200).json({
        ok: true, action: 'use',
        message: next > 0 ? `Einlösung ok — ${next}× übrig.` : 'Letzte Einlösung — Karte aufgebraucht.',
        pass: { serial, remaining: next, status: next <= 0 ? 'depleted' : 'active' },
      });
    }

    // ---- GUTHABEN (balance): Betrag abziehen ----
    if (camp.type === 'balance') {
      const unit = (camp.config && camp.config.unit) || '€';
      const left = Number(pass.remaining) || 0;
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        // Scanner muss den abzubuchenden Betrag erfragen.
        return res.status(200).json({ ok: false, action: 'need_amount', message: 'Betrag zum Abbuchen eingeben.', pass: { serial, remaining: left, unit } });
      }
      if (amt > left) {
        return res.status(409).json({ ok: false, action: 'insufficient', message: `Nicht genug Guthaben (${left} ${unit}).`, pass: { serial, remaining: left, unit } });
      }
      const next = Math.round((left - amt) * 100) / 100;
      await touchPass({ remaining: next, ...(next <= 0 ? { status: 'depleted' } : {}) });
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'debit', note: `-${amt} ${unit} (${next} übrig)` });
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
      return res.status(200).json({
        ok: true, action: 'debit',
        message: `${amt} ${unit} abgebucht — ${next} ${unit} übrig.`,
        pass: { serial, remaining: next, unit, status: next <= 0 ? 'depleted' : 'active' },
      });
    }

    // ---- ZUGANGSPASS (access) ----
    if (camp.type === 'access') {
      const cfg = camp.config || {};
      // ZEIT-PASS: Fenster startet mit dem ERSTEN Scan; weitere Scans innerhalb des Fensters erlaubt.
      if (cfg.tage) {
        const startMs = (await firstEntryMs()) ?? Date.now();   // erster Scan startet das Fenster
        const untilMs = startMs + cfg.tage * 86400000;
        if (Date.now() > untilMs) {
          if (pass.status !== 'expired') await touchPass({ status: 'expired' });
          return res.status(409).json({ ok: false, action: 'expired', message: `Pass abgelaufen (galt ${cfg.tage} Tage).`, pass: { serial, status: 'expired' } });
        }
        const dayNum = Math.min(cfg.tage, Math.floor((Date.now() - startMs) / 86400000) + 1);
        await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'entry', note: `Tag ${dayNum}/${cfg.tage}` });
        await touchPass({});   // updated_at anstoßen -> Wallet-Push zeigt aktuellen Tag
        try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
        return res.status(200).json({ ok: true, action: 'entry', message: `Zutritt bestätigt — Tag ${dayNum}/${cfg.tage}.`, pass: { serial, status: 'active' } });
      }
      // klassischer Zugang (feste Daten / einmalig)
      if (pass.status === 'redeemed') {
        return res.status(409).json({ ok: false, action: 'already', message: 'Zugang wurde bereits genutzt.' });
      }
      if (!withinValidity(cfg, Date.now())) {
        if (pass.status !== 'expired') await touchPass({ status: 'expired' });
        return res.status(409).json({ ok: false, action: 'expired', message: 'Zugang ist abgelaufen oder noch nicht gültig.' });
      }
      const repeat = !!cfg.repeat;
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'entry', note: camp.title });
      if (!repeat) await touchPass({ status: 'redeemed' });
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
      return res.status(200).json({
        ok: true, action: 'entry',
        message: repeat ? `Zutritt bestätigt: ${camp.title}` : `Zutritt bestätigt (einmalig): ${camp.title}`,
        pass: { serial, status: repeat ? 'active' : 'redeemed' },
      });
    }

    // ---- GUTSCHEIN ----
    if (camp.type === 'coupon') {
      if (pass.status === 'redeemed') {
        return res.status(409).json({ ok: false, action: 'already', message: 'Gutschein wurde bereits eingelöst.' });
      }
      await db.from('passes').update({ status: 'redeemed', updated_at: new Date().toISOString() }).eq('id', pass.id);
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'redeem', note: camp.title });
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
      return res.status(200).json({
        ok: true, action: 'redeemed',
        message: `Gutschein eingelöst: ${camp.title}`,
        pass: { serial, status: 'redeemed' },
      });
    }

    // ---- STEMPELKARTE ----
    // "voll" wird ueber stamps >= goal abgebildet (kein eigener Status — die DB-Spalte
    // status erlaubt per Check-Constraint nur bestimmte Werte). Status bleibt 'active'.
    const goal = camp.stamp_goal || 10;
    const reward = camp.reward || 'Belohnung';
    const isFull = (pass.stamps || 0) >= goal;
    const touch = (fields) => db.from('passes').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', pass.id);

    // (A) Belohnung einlösen — vom Button "Belohnung einlösen" auf einer vollen Karte.
    if (redeemReward) {
      if (!isFull) return res.status(409).json({ ok: false, message: 'Karte ist noch nicht voll.' });
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'redeem', note: 'Belohnung: ' + reward });
      const { error: uErr } = await touch({ stamps: 0 });
      if (uErr) { console.error('redeem reward update:', uErr.message); return res.status(500).json({ ok: false, message: 'Aktion fehlgeschlagen. Bitte erneut versuchen.' }); }
      try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
      return res.status(200).json({
        ok: true, action: 'reward_redeemed', reward,
        message: `Belohnung eingelöst: ${reward}. Karte zurückgesetzt.`,
        pass: { serial, stamps: 0, goal, status: 'active' },
      });
    }

    // (B) Karte ist bereits voll -> Belohnung anbieten (kein weiterer Stempel).
    if (isFull) {
      return res.status(200).json({
        ok: true, action: 'reward_ready', reward, title: camp.title,
        message: `Karte voll — Belohnung bereit: ${reward}`,
        pass: { serial, stamps: goal, goal, status: 'full' },
      });
    }

    // (C) Normaler Stempel.
    const stamps = (pass.stamps || 0) + 1;
    const { error: uErr } = await touch({ stamps });
    if (uErr) { console.error('redeem stamp update:', uErr.message); return res.status(500).json({ ok: false, message: 'Aktion fehlgeschlagen. Bitte erneut versuchen.' }); }
    await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'stamp', note: `${stamps}/${goal}` });
    try { await notifyWallets(db, serial); } catch (e) { console.error('push:', e); }
    if (stamps >= goal) {
      // Karte ist JETZT voll -> Belohnung anbieten (NICHT zuruecksetzen, Belohnung wartet).
      return res.status(200).json({
        ok: true, action: 'reward_ready', reward, title: camp.title,
        message: `Karte voll! Belohnung freigeschaltet: ${reward}`,
        pass: { serial, stamps: goal, goal, status: 'full' },
      });
    }
    return res.status(200).json({
      ok: true, action: 'stamp', message: `Stempel ${stamps}/${goal} vergeben.`,
      pass: { serial, stamps, goal, status: 'active' },
    });
  } catch (e) {
    console.error('redeem error:', e && (e.stack || e.message || e));
    return res.status(500).json({ ok: false, message: 'Serverfehler. Bitte erneut versuchen.' });
  }
}

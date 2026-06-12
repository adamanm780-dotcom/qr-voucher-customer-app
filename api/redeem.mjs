// Vercel Serverless: Entwertung / Stempeln.
// POST /api/redeem  { serial: "LILA-XXXXXX", business_id?: "<uuid>" }
//  - Gutschein (campaign.type=coupon): Pass -> status 'redeemed' (einmalig). Zweiter Scan -> Fehler.
//  - Stempelkarte (stampcard): stamps +1. Bei stamps>=stamp_goal -> 'completed' (Belohnung frei) + reset auf 0.
// Antwort: { ok, action, message, pass:{serial,stamps,goal,status} }
import { createClient } from '@supabase/supabase-js';
import { pushUpdate } from './_apns.mjs';
import { setCors } from '../lib/security.mjs';

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
    const { serial, redeemReward } = await readBody(req);
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

    // ---- GUTSCHEIN ----
    if (camp.type === 'coupon') {
      if (pass.status === 'redeemed') {
        return res.status(409).json({ ok: false, action: 'already', message: 'Gutschein wurde bereits eingelöst.' });
      }
      await db.from('passes').update({ status: 'redeemed', updated_at: new Date().toISOString() }).eq('id', pass.id);
      await db.from('redemptions').insert({ pass_id: pass.id, business_id: pass.business_id, action: 'redeem', note: camp.title });
      try { await pushUpdate(db, serial); } catch (e) { console.error('push:', e); }
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
      try { await pushUpdate(db, serial); } catch (e) { console.error('push:', e); }
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
    try { await pushUpdate(db, serial); } catch (e) { console.error('push:', e); }
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

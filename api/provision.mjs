// FlowState — neuen Kunden-Betrieb in Sekunden anlegen.
// POST /api/provision  { name: "Café Schmidt" }   Header: x-admin-key: <ADMIN_KEY>
// Erzeugt: Auth-Login + businesses-Eintrag + 2 Beispiel-Aktionen (Stempelkarte + Gutschein).
// Antwort: { ok, name, email, password, slug, loginUrl }
// Schutz: nur mit gültigem x-admin-key (ENV ADMIN_KEY). Server nutzt SUPABASE_SECRET_KEY (umgeht RLS).
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { setCors, safeEqual } from '../lib/security.mjs';

const APP_URL = 'https://qr-voucher-customer-app.vercel.app';

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve) => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}
function pick(set, n) { let s = ''; for (let i = 0; i < n; i++) s += set[crypto.randomInt(set.length)]; return s; }
function slugify(name) {
  return (name || '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'betrieb';
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Nur POST' });

  // Schutz: Admin-Schlüssel timing-sicher prüfen (fail-closed ohne ENV).
  const key = req.headers['x-admin-key'] || '';
  if (!process.env.ADMIN_KEY || !safeEqual(key, process.env.ADMIN_KEY)) {
    return res.status(401).json({ ok: false, message: 'Kein Zugriff (falscher oder fehlender Admin-Schlüssel).' });
  }

  try {
    const { name } = await readBody(req);
    if (!name || !name.trim()) return res.status(400).json({ ok: false, message: 'Name fehlt.' });

    const db = supa();
    const base = slugify(name);
    const slug = `${base}-${pick('abcdefghijkmnpqrstuvwxyz23456789', 4)}`;       // eindeutig
    const email = `${slug}@kunden.flowstate.app`;
    // Starkes, aber tippbares Passwort: 3×4 Zeichen aus 32er-Satz (ohne verwechselbare 0/O/1/I). ~1e18 Keyspace.
    const PWSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const password = `${pick(PWSET, 4)}-${pick(PWSET, 4)}-${pick(PWSET, 4)}`; // z.B. K7MP-3RXQ-9FBT

    // 1) Login anlegen
    const { data: userData, error: userErr } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (userErr) return res.status(500).json({ ok: false, message: 'Login-Anlage fehlgeschlagen: ' + userErr.message });
    const userId = userData.user.id;

    // 2) Betrieb anlegen (neutrales Default-Branding; pro Kunde später anpassbar)
    const { data: biz, error: bizErr } = await db.from('businesses')
      .insert({ owner_id: userId, name: name.trim(), slug, color_bg: '#6b5cff', color_text: '#ffffff' })
      .select().single();
    if (bizErr) {
      await db.auth.admin.deleteUser(userId); // sauber zurückrollen
      return res.status(500).json({ ok: false, message: 'Betrieb-Anlage fehlgeschlagen: ' + bizErr.message });
    }

    // 3) Beispiel-Aktionen, damit das Dashboard beim Pitch sofort lebendig ist
    await db.from('campaigns').insert([
      { business_id: biz.id, type: 'coupon', title: '20% Rabatt', value: '20%', active: true },
      { business_id: biz.id, type: 'stampcard', title: 'Stempelkarte · 1 Kaffee gratis', stamp_goal: 10,
        reward: '1 Kaffee gratis', enroll_token: crypto.randomBytes(8).toString('hex'), active: true },
    ]);

    return res.status(200).json({ ok: true, name: name.trim(), email, password, slug, loginUrl: APP_URL });
  } catch (e) {
    console.error('provision error:', e && (e.stack || e.message || e));
    return res.status(500).json({ ok: false, message: 'Anlegen fehlgeschlagen.' });
  }
}

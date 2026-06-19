// FlowState Admin-Cockpit — Backend. NUR für FlowState-Admins (du + Cofounder).
//   GET  /api/admin/businesses      -> Liste ALLER Betriebe (Überblick)
//   POST /api/admin/impersonate {business_id} -> Magic-Link, um als dieser Betrieb ins Dashboard zu kommen
//
// Sicherheit (fail-closed):
//   - Caller muss einen gültigen Supabase-Access-Token mitschicken (Authorization: Bearer <jwt>).
//   - Dessen E-Mail muss in ENV ADMIN_EMAILS (kommagetrennt) stehen. Sonst 403.
//   - Service-Key (umgeht RLS) wird erst NACH bestandener Admin-Prüfung benutzt.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const APP = 'https://qr-voucher-customer-app.vercel.app';

// Lesbares Passwort, leicht an einer Marke erkennbar: z.B. "Cinnamood" -> "Cinna-7K4P".
function genPassword(name) {
  const base = (name || '').replace(/[^a-zA-Z]/g, '');
  const pre = base ? (base[0].toUpperCase() + base.slice(1, 5).toLowerCase()) : 'FS';
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = Array.from({ length: 4 }, () => set[crypto.randomInt(set.length)]).join('');
  return `${pre}-${rnd}`;
}
const svc = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Branchen/Nischen (Phase 1) — kanonische IDs. Neue Nischen hier + im Cockpit ergänzen.
const INDUSTRIES = ['gastronomie', 'cafe', 'arbeitgeber', 'kantine', 'fitness', 'beauty', 'waschanlage', 'freizeit', 'event', 'verein', 'bildung', 'sonstige'];

function adminList() {
  return (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
async function requireAdmin(req, db) {
  const allow = adminList();
  if (!allow.length) return { error: 'ADMIN_EMAILS nicht konfiguriert', code: 503 };
  const jwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return { error: 'Kein Token', code: 401 };
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return { error: 'Token ungültig', code: 401 };
  const email = (data.user.email || '').toLowerCase();
  if (!allow.includes(email)) return { error: 'Kein Admin-Zugriff', code: 403 };
  return { user: data.user };
}
async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return await new Promise((res) => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch { res({}); } }); });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = svc();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/admin/, '').replace(/^\//, '');

  const gate = await requireAdmin(req, db);
  if (gate.error) return res.status(gate.code).json({ ok: false, message: gate.error });

  try {
    // --- Leichter Admin-Check (fürs Login-Routing — kein Datenballast) ---
    if (req.method === 'GET' && path === 'ping') {
      return res.status(200).json({ ok: true });
    }

    // --- Überblick: alle Betriebe ---
    if (req.method === 'GET' && (path === 'businesses' || path === '')) {
      // '*' (statt fester Spaltenliste), damit ein noch nicht migriertes 'industry' die Query nicht crasht.
      const { data: bizs, error } = await db.from('businesses')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ ok: false, message: error.message });

      // Statt 2 Count-Queries PRO Betrieb (wurde mit jedem Betrieb langsamer):
      // alles in 3 parallelen Aufrufen holen und im Code gruppieren.
      const [usersRes, passRes, campRes] = await Promise.all([
        db.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => null),
        db.from('passes').select('business_id').eq('status', 'active').limit(20000),
        db.from('campaigns').select('business_id').eq('active', true).limit(20000),
      ]);
      const emailById = new Map();
      for (const u of usersRes?.data?.users || []) emailById.set(u.id, u.email || null);
      const tally = (rows) => {
        const m = new Map();
        for (const r of rows || []) m.set(r.business_id, (m.get(r.business_id) || 0) + 1);
        return m;
      };
      const passCount = tally(passRes?.data), campCount = tally(campRes?.data);
      const out = (bizs || []).map((b) => ({
        ...b, owner_email: emailById.get(b.owner_id) || null,
        industry: b.industry || 'gastronomie',
        activePasses: passCount.get(b.id) || 0, activeCampaigns: campCount.get(b.id) || 0,
      }));
      return res.status(200).json({ ok: true, businesses: out });
    }

    // --- Als Betrieb einloggen (Impersonation per Magic-Link) ---
    if (req.method === 'POST' && path === 'impersonate') {
      const { business_id } = await readBody(req);
      if (!business_id) return res.status(400).json({ ok: false, message: 'business_id fehlt' });
      const { data: biz } = await db.from('businesses').select('id,name,owner_id').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ ok: false, message: 'Betrieb nicht gefunden' });
      const u = await db.auth.admin.getUserById(biz.owner_id);
      const email = u?.data?.user?.email;
      if (!email) return res.status(404).json({ ok: false, message: 'Owner-Login nicht gefunden' });
      // Magic-Link erzeugen und serverseitig EINMAL einlösen -> Session-Tokens aus dem Redirect ziehen.
      // So sind wir unabhängig von Supabase Site-URL/Redirect-Allowlist.
      const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
      if (error) return res.status(500).json({ ok: false, message: error.message });
      const r = await fetch(link.properties.action_link, { redirect: 'manual' });
      const loc = r.headers.get('location') || '';
      const frag = loc.includes('#') ? loc.split('#')[1] : (loc.split('?')[1] || '');
      const p = new URLSearchParams(frag);
      const access_token = p.get('access_token'), refresh_token = p.get('refresh_token');
      if (!access_token || !refresh_token) return res.status(500).json({ ok: false, message: 'Session konnte nicht erzeugt werden' });
      return res.status(200).json({ ok: true, business: biz.name, access_token, refresh_token });
    }

    // --- Zugangsdaten: neues Passwort setzen + zurückgeben (nicht zurücklesbar -> reset & reveal) ---
    if (req.method === 'POST' && path === 'credentials') {
      const { business_id } = await readBody(req);
      if (!business_id) return res.status(400).json({ ok: false, message: 'business_id fehlt' });
      const { data: biz } = await db.from('businesses').select('id,name,owner_id').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ ok: false, message: 'Betrieb nicht gefunden' });
      if (!biz.owner_id) return res.status(404).json({ ok: false, message: 'Kein Login mit diesem Betrieb verknüpft.' });
      const u = await db.auth.admin.getUserById(biz.owner_id);
      const email = u?.data?.user?.email;
      if (!email) return res.status(404).json({ ok: false, message: 'Login-Konto nicht gefunden.' });
      const password = genPassword(biz.name);
      const { error } = await db.auth.admin.updateUserById(biz.owner_id, { password });
      if (error) { console.error('credentials set:', error.message); return res.status(500).json({ ok: false, message: 'Passwort konnte nicht gesetzt werden.' }); }
      return res.status(200).json({ ok: true, business: biz.name, email, password });
    }

    // --- Design hochladen -> in Storage ablegen (Claude baut daraus den Betrieb) ---
    if (req.method === 'POST' && path === 'upload-design') {
      const body = await readBody(req);
      const { name, goal, reward, color_bg, image_b64, logo_b64, note, positions, rfr, industry } = body;
      if (!name || !name.trim()) return res.status(400).json({ ok: false, message: 'Name fehlt' });
      if (!image_b64) return res.status(400).json({ ok: false, message: 'Bild fehlt' });
      const raw = String(image_b64).replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ ok: false, message: 'Bild zu groß (max 6 MB)' });
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const hasLogo = !!logo_b64;
      const validPos = Array.isArray(positions) ? positions.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number').map(p => ({ x: p.x, y: p.y })) : null;
      const ind = INDUSTRIES.includes(industry) ? industry : 'gastronomie';
      const meta = { id, name: name.trim(), goal: Number(goal) === 10 ? 10 : 5, reward: (reward || 'Gratis-Belohnung').trim(), color_bg: color_bg || null, industry: ind, hasLogo, note: (note || '').trim(), positions: validPos, rfr: (typeof rfr === 'number' ? rfr : null), ts: new Date().toISOString(), status: 'pending' };
      const up1 = await db.storage.from('design-uploads').upload(`pending/${id}.png`, buf, { contentType: 'image/png', upsert: true });
      if (up1.error) return res.status(500).json({ ok: false, message: 'Upload-Fehler: ' + up1.error.message });
      if (hasLogo) {
        const lraw = String(logo_b64).replace(/^data:image\/\w+;base64,/, '');
        await db.storage.from('design-uploads').upload(`pending/${id}-logo.png`, Buffer.from(lraw, 'base64'), { contentType: 'image/png', upsert: true });
      }
      await db.storage.from('design-uploads').upload(`pending/${id}.json`, Buffer.from(JSON.stringify(meta, null, 2)), { contentType: 'application/json', upsert: true });
      // bytes zurückmelden -> Client bestätigt, dass der Designstreifen wirklich angekommen ist
      return res.status(200).json({ ok: true, id, bytes: buf.length, message: 'Design hochgeladen — wird gebaut.' });
    }

    // --- Karten-Farbe (Kartenkörper unter dem Design) ändern ---
    // color_bg wird zur Pass-Laufzeit LIVE aus der DB gelesen -> kein Deploy nötig, wirkt beim nächsten Karten-Update.
    if (req.method === 'POST' && path === 'update-business') {
      const { business_id, color_bg } = await readBody(req);
      if (!business_id) return res.status(400).json({ ok: false, message: 'business_id fehlt' });
      const hex = String(color_bg || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return res.status(400).json({ ok: false, message: 'Ungültige Farbe (erwarte #RRGGBB).' });
      const { data: biz } = await db.from('businesses').select('id,slug,name').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ ok: false, message: 'Betrieb nicht gefunden' });
      // Lila hat im Pass feste Farben (theme.mjs) -> DB-Änderung würde nichts bewirken. Ehrlich blocken.
      if (biz.slug === 'lila-wiesbaden') return res.status(403).json({ ok: false, message: 'Lila hat feste Marken-Farben und kann hier nicht geändert werden.' });
      const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const color_text = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff';
      const { error } = await db.from('businesses').update({ color_bg: hex, color_text }).eq('id', biz.id);
      if (error) return res.status(500).json({ ok: false, message: error.message });
      return res.status(200).json({ ok: true, color_bg: hex, color_text, message: 'Farbe gespeichert — wirkt beim nächsten Karten-Update.' });
    }

    // --- Branche/Nische eines Betriebs ändern (Phase 1) ---
    if (req.method === 'POST' && path === 'set-industry') {
      const { business_id, industry } = await readBody(req);
      if (!business_id) return res.status(400).json({ ok: false, message: 'business_id fehlt' });
      if (!INDUSTRIES.includes(industry)) return res.status(400).json({ ok: false, message: 'Unbekannte Nische.' });
      const { error } = await db.from('businesses').update({ industry }).eq('id', business_id);
      if (error) return res.status(500).json({ ok: false, message: error.message });
      return res.status(200).json({ ok: true, industry });
    }

    // --- Betrieb löschen (Betrieb + Login + Kampagnen + Pässe + Registrierungen) ---
    if (req.method === 'POST' && path === 'delete-business') {
      const { business_id } = await readBody(req);
      if (!business_id) return res.status(400).json({ ok: false, message: 'business_id fehlt' });
      const { data: biz } = await db.from('businesses').select('id,slug,owner_id,name').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ ok: false, message: 'Betrieb nicht gefunden' });
      if (biz.slug === 'lila-wiesbaden') return res.status(403).json({ ok: false, message: 'Lila ist geschützt und kann nicht gelöscht werden.' });

      const { data: passes } = await db.from('passes').select('serial').eq('business_id', biz.id);
      const serials = (passes || []).map(p => p.serial);
      if (serials.length) await db.from('device_registrations').delete().in('pass_serial', serials);
      await db.from('redemptions').delete().eq('business_id', biz.id);
      await db.from('passes').delete().eq('business_id', biz.id);
      await db.from('campaigns').delete().eq('business_id', biz.id);
      await db.from('businesses').delete().eq('id', biz.id);
      if (biz.owner_id) { try { await db.auth.admin.deleteUser(biz.owner_id); } catch {} }
      return res.status(200).json({ ok: true, message: `„${biz.name}" gelöscht.` });
    }

    // --- Verbesserung/Notiz zu einem Betrieb hinterlassen (für den Agenten) ---
    if (req.method === 'POST' && path === 'feedback') {
      const { business_id, business_name, note } = await readBody(req);
      if (!note || !note.trim()) return res.status(400).json({ ok: false, message: 'Notiz fehlt' });
      const fid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const rec = { id: fid, business_id: business_id || null, business_name: business_name || null, note: note.trim(), ts: new Date().toISOString(), status: 'open' };
      const up = await db.storage.from('design-uploads').upload(`feedback/${fid}.json`, Buffer.from(JSON.stringify(rec, null, 2)), { contentType: 'application/json', upsert: true });
      if (up.error) return res.status(500).json({ ok: false, message: up.error.message });
      return res.status(200).json({ ok: true, message: 'Notiz gespeichert — wird bearbeitet.' });
    }

    // --- Offene Verbesserungen listen ---
    if (req.method === 'GET' && path === 'feedback') {
      const { data: files } = await db.storage.from('design-uploads').list('feedback', { limit: 200 });
      const out = [];
      for (const f of (files || []).filter(x => x.name.endsWith('.json'))) {
        const { data } = await db.storage.from('design-uploads').download(`feedback/${f.name}`);
        if (data) { try { out.push(JSON.parse(await data.text())); } catch {} }
      }
      return res.status(200).json({ ok: true, feedback: out });
    }

    // --- Offene Uploads listen (für "in Arbeit"-Anzeige) ---
    if (req.method === 'GET' && path === 'uploads') {
      const { data: files } = await db.storage.from('design-uploads').list('pending', { limit: 100 });
      const metas = [];
      for (const f of (files || []).filter(x => x.name.endsWith('.json'))) {
        const { data } = await db.storage.from('design-uploads').download(`pending/${f.name}`);
        if (data) { try { metas.push(JSON.parse(await data.text())); } catch {} }
      }
      return res.status(200).json({ ok: true, uploads: metas });
    }

    return res.status(404).json({ ok: false, message: 'Unbekannter Endpunkt' });
  } catch (e) {
    console.error('admin error:', e && (e.stack || e.message || e));
    return res.status(500).json({ ok: false, message: 'Serverfehler.' });
  }
}

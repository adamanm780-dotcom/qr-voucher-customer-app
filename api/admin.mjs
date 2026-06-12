// FlowState Admin-Cockpit — Backend. NUR für FlowState-Admins (du + Cofounder).
//   GET  /api/admin/businesses      -> Liste ALLER Betriebe (Überblick)
//   POST /api/admin/impersonate {business_id} -> Magic-Link, um als dieser Betrieb ins Dashboard zu kommen
//
// Sicherheit (fail-closed):
//   - Caller muss einen gültigen Supabase-Access-Token mitschicken (Authorization: Bearer <jwt>).
//   - Dessen E-Mail muss in ENV ADMIN_EMAILS (kommagetrennt) stehen. Sonst 403.
//   - Service-Key (umgeht RLS) wird erst NACH bestandener Admin-Prüfung benutzt.
import { createClient } from '@supabase/supabase-js';

const APP = 'https://qr-voucher-customer-app.vercel.app';
const svc = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

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
    // --- Überblick: alle Betriebe ---
    if (req.method === 'GET' && (path === 'businesses' || path === '')) {
      const { data: bizs, error } = await db.from('businesses')
        .select('id,name,slug,logo_url,color_bg,color_text,owner_id,created_at')
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ ok: false, message: error.message });

      const out = [];
      for (const b of bizs || []) {
        let email = null;
        try { const u = await db.auth.admin.getUserById(b.owner_id); email = u?.data?.user?.email || null; } catch {}
        const [{ count: passes }, { count: camps }] = await Promise.all([
          db.from('passes').select('*', { count: 'exact', head: true }).eq('business_id', b.id).eq('status', 'active'),
          db.from('campaigns').select('*', { count: 'exact', head: true }).eq('business_id', b.id).eq('active', true),
        ]);
        out.push({ ...b, owner_email: email, activePasses: passes || 0, activeCampaigns: camps || 0 });
      }
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

    // --- Design hochladen -> in Storage ablegen (Claude baut daraus den Betrieb) ---
    if (req.method === 'POST' && path === 'upload-design') {
      const body = await readBody(req);
      const { name, goal, reward, color_bg, image_b64, logo_b64, note, positions, rfr } = body;
      if (!name || !name.trim()) return res.status(400).json({ ok: false, message: 'Name fehlt' });
      if (!image_b64) return res.status(400).json({ ok: false, message: 'Bild fehlt' });
      const raw = String(image_b64).replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ ok: false, message: 'Bild zu groß (max 6 MB)' });
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const hasLogo = !!logo_b64;
      const validPos = Array.isArray(positions) ? positions.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number').map(p => ({ x: p.x, y: p.y })) : null;
      const meta = { id, name: name.trim(), goal: Number(goal) === 10 ? 10 : 5, reward: (reward || 'Gratis-Belohnung').trim(), color_bg: color_bg || null, hasLogo, note: (note || '').trim(), positions: validPos, rfr: (typeof rfr === 'number' ? rfr : null), ts: new Date().toISOString(), status: 'pending' };
      const up1 = await db.storage.from('design-uploads').upload(`pending/${id}.png`, buf, { contentType: 'image/png', upsert: true });
      if (up1.error) return res.status(500).json({ ok: false, message: 'Upload-Fehler: ' + up1.error.message });
      if (hasLogo) {
        const lraw = String(logo_b64).replace(/^data:image\/\w+;base64,/, '');
        await db.storage.from('design-uploads').upload(`pending/${id}-logo.png`, Buffer.from(lraw, 'base64'), { contentType: 'image/png', upsert: true });
      }
      await db.storage.from('design-uploads').upload(`pending/${id}.json`, Buffer.from(JSON.stringify(meta, null, 2)), { contentType: 'application/json', upsert: true });
      return res.status(200).json({ ok: true, id, message: 'Design hochgeladen — wird gebaut.' });
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

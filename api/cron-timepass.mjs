// Täglicher Cron: aktualisiert alle aktiven ZEIT-PÄSSE (access mit config.tage), damit die roten
// Kreuze jeden Tag von allein in der Wallet wachsen — auch ohne Gym-Besuch/Scan.
// Push triggert Apple -> holt v1 getpass -> neuer strip_<Tag>. Läuft via Vercel Cron (vercel.json).
import { createClient } from '@supabase/supabase-js';
import { pushUpdate } from './_apns.mjs';

const DAY = 86400000;

export default async function handler(req, res) {
  // Schutz: wenn CRON_SECRET gesetzt ist, muss der Bearer passen (Vercel Cron sendet ihn automatisch).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (got !== secret) return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  try {
    const { data: camps } = await db.from('campaigns').select('id,config').eq('type', 'access');
    const tageCamps = (camps || []).filter(c => c.config && c.config.tage);
    let checked = 0, pushed = 0;
    for (const c of tageCamps) {
      const { data: passes } = await db.from('passes').select('id,serial,status').eq('campaign_id', c.id);
      for (const p of passes || []) {
        if (p.status === 'expired') continue;
        // Start = erster Scan (erste 'entry'-redemption). Noch nicht gestartet -> nichts zu tun (bleibt leer).
        const { data: first } = await db.from('redemptions').select('created_at').eq('pass_id', p.id).eq('action', 'entry').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!first) continue;
        checked++;
        const untilMs = Date.parse(first.created_at) + c.config.tage * DAY;
        if (Date.now() <= untilMs + DAY) {   // im Fenster (+1 Tag, damit der finale Stand noch gepusht wird)
          try { await pushUpdate(db, p.serial); pushed++; } catch (e) { console.error('push', p.serial, e?.message); }
        }
      }
    }
    return res.status(200).json({ ok: true, checked, pushed });
  } catch (e) {
    console.error('cron-timepass:', e?.stack || e?.message || e);
    return res.status(500).json({ ok: false });
  }
}

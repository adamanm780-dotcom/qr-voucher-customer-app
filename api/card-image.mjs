// Liefert das Karten-BILD (Strip, leerer Stand) als PNG — für die /add-Konfetti-Seite.
//   /api/card-image?enroll=<token> | ?campaign=<id> | ?demo=stamp5|stamp10|coupon
import { createClient } from '@supabase/supabase-js';
import { themeFor, assetKey, loadAssets, campaignDir } from '../lib/theme.mjs';

const supa = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const demo = url.searchParams.get('demo');
    const enroll = url.searchParams.get('enroll');
    const campaign = url.searchParams.get('campaign');
    const business = url.searchParams.get('business');

    let type = 'stampcard', goal = 5, prefix = '', slug = null, campId = null;

    if (demo) {
      type = demo.startsWith('stamp') ? 'stampcard' : 'coupon';
      goal = demo === 'stamp10' ? 10 : 5;
    } else if (business) {
      // Vorschau fürs Cockpit-Einstellungen-Panel: Strip eines Betriebs (über seine erste Aktion).
      const db = supa();
      const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text').eq('id', business).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Betrieb nicht gefunden' });
      const { data: camp } = await db.from('campaigns').select('id,type,stamp_goal').eq('business_id', business).order('created_at', { ascending: true }).limit(1).maybeSingle();
      const theme = themeFor(biz);
      type = camp?.type || 'stampcard'; goal = camp?.stamp_goal || 5; prefix = theme.prefix; slug = biz.slug; campId = camp?.id || null;
    } else if (enroll || campaign) {
      const db = supa();
      const q = enroll ? db.from('campaigns').select('*').eq('enroll_token', enroll)
                       : db.from('campaigns').select('*').eq('id', campaign);
      const { data: camp } = await q.maybeSingle();
      if (!camp) return res.status(404).json({ error: 'nicht gefunden' });
      const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text').eq('id', camp.business_id).maybeSingle();
      const theme = themeFor(biz);
      type = camp.type; goal = camp.stamp_goal || 5; prefix = theme.prefix; slug = biz?.slug; campId = camp.id;
    } else {
      return res.status(400).json({ error: 'Parameter fehlt' });
    }

    // Eigenes Design pro Aktion bevorzugen, sonst mechanik-gekoppelte Assets.
    const key = campaignDir(slug, campId) || assetKey(type, goal, prefix);
    const stripName = (type === 'stampcard' && !campaignDir(slug, campId)) ? 'strip_0' : 'strip';
    const assets = loadAssets(key, stripName);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(assets['strip@3x.png']);
  } catch (e) {
    console.error('card-image error:', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Bild konnte nicht geladen werden.' });
  }
}

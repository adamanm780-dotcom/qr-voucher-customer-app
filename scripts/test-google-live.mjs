// Echter End-to-End-Test: baut für eine Kampagne eine Google-Karte, legt sie via API an,
// und gibt den "Save to Google Wallet"-Link aus. Aufruf: node scripts/test-google-live.mjs <campaignId> [stamps]
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { themeFor } from '../lib/theme.mjs';
import { buildGoogleCard } from '../lib/googleview.mjs';
import { ensureClass, upsertObject, saveLink } from '../api/_google.mjs';

const campaignId = process.argv[2];
const stamps = Number(process.argv[3] || 3);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: camp } = await db.from('campaigns').select('*').eq('id', campaignId).single();
if (!camp) { console.log('Kampagne nicht gefunden'); process.exit(1); }
const { data: biz } = await db.from('businesses').select('name,slug,color_bg,color_text,logo_url').eq('id', camp.business_id).maybeSingle();
const theme = themeFor(biz);
const serial = 'DEMO-' + ((biz?.slug || 'fs').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)) + '-1';
const heroUrl = `https://qr-voucher-customer-app.vercel.app/api/card-image?campaign=${camp.id}`;
const logoUrl = biz?.logo_url || null;

const { classObj, object, oid } = buildGoogleCard({
  camp, pass: { stamps, remaining: null, startMs: null },
  theme, slug: biz?.slug, serial, org: theme.org, heroUrl, logoUrl,
});

const c = await ensureClass(classObj);
console.log('Klasse  HTTP:', c.status);
const o = await upsertObject(object);
console.log('Objekt  HTTP:', o.status, o.status >= 400 ? JSON.stringify(o.body).slice(0, 300) : '(ok)');
console.log('Betrieb:', theme.org, '| Farbe:', object.hexBackgroundColor, '| Felder:', object.textModulesData.map(r => `${r.header}:${r.body}`).join(' / '));
console.log('\n=== SAVE-LINK (in jedem Browser öffnen) ===');
console.log(saveLink({ id: oid, classId: classObj.id }));

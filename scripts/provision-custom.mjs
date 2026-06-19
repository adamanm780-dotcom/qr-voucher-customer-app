// Provisioniert EINEN Betrieb mit eigenem Design (exakter slug -> passt zum Asset-Ordner).
// node scripts/provision-custom.mjs <config.json>
//   config: { slug, name, colorBg, colorText, logoUrl, reward, goal(5|10), email?, password? }
// Service-Key umgeht RLS. Idempotent: existiert der slug schon, wird er wiederverwendet.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const env = Object.fromEntries(readFileSync(join(process.cwd(), '.env'), 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const APP = 'https://qr-voucher-customer-app.vercel.app';
const pick = (set, n) => Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join('');

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const goal = cfg.goal || 5;
const industry = cfg.industry || 'gastronomie';   // Branche/Nische (Phase 1) — Default Gastronomie
const email = cfg.email || `${cfg.slug}@kunden.flowstate.app`;
const password = cfg.password || ('FS-' + pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 4) + pick('23456789', 3));

console.log(`\nProvisioniere "${cfg.name}" (slug ${cfg.slug}) …`);

// 0) Existiert der Betrieb schon?
const { data: existingBiz } = await db.from('businesses').select('*').eq('slug', cfg.slug).maybeSingle();
let biz = existingBiz;

// 1) Login: existiert der User? sonst anlegen
let userId;
{
  // Supabase hat kein getUserByEmail -> über businesses.owner_id falls vorhanden, sonst neu anlegen
  if (biz && biz.owner_id) {
    userId = biz.owner_id;
    // Passwort neu setzen, damit wir es sicher kennen
    await db.auth.admin.updateUserById(userId, { password });
    console.log('  Login existiert -> Passwort neu gesetzt.');
  } else {
    const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) { console.error('  Login-Fehler:', error.message); process.exit(1); }
    userId = u.user.id;
    console.log('  Login angelegt.');
  }
}

// 2) Betrieb anlegen/aktualisieren (Markenfarben + Logo)
if (!biz) {
  const { data, error } = await db.from('businesses').insert({
    owner_id: userId, name: cfg.name, slug: cfg.slug,
    color_bg: cfg.colorBg, color_text: cfg.colorText, logo_url: cfg.logoUrl || null,
    industry,
  }).select().single();
  if (error) { console.error('  Betrieb-Fehler:', error.message); process.exit(1); }
  biz = data;
  console.log('  Betrieb angelegt.');
} else {
  await db.from('businesses').update({
    name: cfg.name, color_bg: cfg.colorBg, color_text: cfg.colorText, logo_url: cfg.logoUrl || biz.logo_url,
  }).eq('id', biz.id);
  console.log('  Betrieb aktualisiert.');
}

// 3) 5er-Stempelkarte (nur anlegen, wenn noch keine aktive Stempelkarte existiert)
const { data: camps } = await db.from('campaigns').select('*').eq('business_id', biz.id).eq('type', 'stampcard');
let camp = (camps || [])[0];
if (!camp) {
  const enroll = crypto.randomBytes(8).toString('hex');
  const { data, error } = await db.from('campaigns').insert({
    business_id: biz.id, type: 'stampcard',
    title: `${cfg.name} · ${cfg.reward}`, stamp_goal: goal, reward: cfg.reward,
    enroll_token: enroll, active: true,
  }).select().single();
  if (error) { console.error('  Kampagne-Fehler:', error.message); process.exit(1); }
  camp = data;
  console.log('  Stempelkarte angelegt.');
} else {
  console.log('  Stempelkarte existiert bereits.');
}

console.log('\n==================  PITCH-PAKET  ==================');
console.log('Betrieb   :', cfg.name);
console.log('Login-URL :', APP);
console.log('E-Mail    :', email);
console.log('Passwort  :', password);
console.log('--- Direkt-Links zum Testen ---');
console.log('Pass (QR) :', `${APP}/api/pass?enroll=${camp.enroll_token}`);
console.log('Kampagne  :', camp.id);
console.log('===================================================\n');

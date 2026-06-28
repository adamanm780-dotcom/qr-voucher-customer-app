// Eine Stelle, die beim Stempeln/Einlösen BEIDE Wallets aktualisiert.
//  - Apple: leeres APNs-Push (no-op, wenn kein Gerät registriert).
//  - Google: GenericObject patchen (no-op, wenn nicht konfiguriert oder keine google_object_id).
import { pushUpdate } from '../api/_apns.mjs';
import { googleConfigured, patchObject } from '../api/_google.mjs';
import { themeFor } from './theme.mjs';
import { googlePatchFor } from './googleview.mjs';

export async function notifyWallets(db, serial) {
  // Apple zuerst — Bestandsverhalten, darf nie ausfallen wegen Google.
  try { await pushUpdate(db, serial); } catch (e) { console.error('apns push:', e); }

  // Google — nur wenn konfiguriert und diese Karte eine Google-Karte ist.
  try {
    if (!googleConfigured()) return;
    const { data: pass } = await db.from('passes').select('*').eq('serial', serial).maybeSingle();
    if (!pass || !pass.google_object_id) return;
    const { data: camp } = await db.from('campaigns').select('*').eq('id', pass.campaign_id).maybeSingle();
    if (!camp) return;
    const { data: biz } = await db.from('businesses')
      .select('name,slug,color_bg,color_text,logo_url').eq('id', pass.business_id).maybeSingle();
    const theme = themeFor(biz);
    const patch = googlePatchFor({ camp, pass, theme, serial, org: theme.org });
    await patchObject(pass.google_object_id, patch);
  } catch (e) { console.error('gwallet patch:', e); }
}

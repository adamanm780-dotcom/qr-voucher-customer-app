// Diagnose: Kann das Service-Konto beim Issuer Klassen anlegen/lesen?
//  200 = berechtigt (Nutzer-Schritt ok). 403 = noch nicht berechtigt. 401 = Key kaputt.
import 'dotenv/config';
import { googleConfigured, ensureClass } from '../api/_google.mjs';
import { classId } from '../lib/googleview.mjs';

if (!googleConfigured()) { console.log('NICHT konfiguriert (Env fehlt)'); process.exit(1); }
const cid = classId('diagtest');
console.log('Issuer:', process.env.GOOGLE_WALLET_ISSUER_ID, '| classId:', cid);
const r = await ensureClass({ id: cid, issuerName: 'FlowState Diag', reviewStatus: 'UNDER_REVIEW' });
console.log('HTTP-Status:', r.status);
if (r.status === 200) console.log('✅ BERECHTIGT — Service-Konto darf anlegen. Nutzer-Schritt ist durch.');
else if (r.status === 403) console.log('⛔ 403 — Service-Konto noch NICHT berechtigt (Nutzer-Schritt fehlt/propagiert noch) ODER Issuer-Zuordnung fehlt.');
else if (r.status === 401) console.log('🔑 401 — Schlüssel/Token-Problem.');
else console.log('Antwort:', JSON.stringify(r.body).slice(0, 500));
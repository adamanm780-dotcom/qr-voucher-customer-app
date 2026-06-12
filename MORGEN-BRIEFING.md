# 🌅 Morgen-Briefing — Was über Nacht gebaut wurde

**Datum:** Nacht zum 02.06.2026
**Kurz:** Die App ist jetzt eine funktionierende, mobile, installierbare Web-App.
Login → Dashboard → Gutschein/Stempelkarte erstellen → QR → **echter signierter Apple-Wallet-Pass**. Alles live getestet.

---

## ✅ Was JETZT funktioniert (alles live + verifiziert)

### 1. Der dynamische Pass-Server (das große neue Stück)
- **`/api/pass`** läuft als echte Serverless-Funktion auf Vercel.
- Erzeugt **on-the-fly signierte .pkpass-Dateien** (kein Vorab-Basteln mehr).
- Drei Modi:
  - `?campaign=<id>` → Gutschein/Karte aus der Datenbank, legt automatisch einen pass-Datensatz an
  - `?enroll=<token>` → Stempelkarten-Onboarding (Dauer-QR am Tresen)
  - `?demo=coupon|stamp5|stamp10` → Test ohne DB
- Zertifikate liegen **sicher als verschlüsselte Vercel-Umgebungsvariablen** (nicht im Code).
- Signatur bei jedem Pass verifiziert: „Verification successful".

### 2. Das Dashboard ist voll verdrahtet
- Login (lila@flowstate.app / Lila2026Test) ✅
- Willkommen-Screen + GO-Animation ✅
- **Erstellen**: Gutschein-Vorlagen (1 Klick) + Stempelkarte (2 Felder) → speichert in DB ✅
- **Meine Aktionen**: Liste + **QR-Button zeigt jetzt den ECHTEN Pass-Link** (vorher tote Links) ✅
- QR scannen → Pass landet in Wallet. Komplett end-to-end getestet.

### 3. PWA — "Zum Home-Bildschirm hinzufügen"
- `manifest.json`, App-Icons (FlowState "F", Cyan-Gradient), Service Worker, Apple-Meta-Tags.
- Auf dem iPhone: Safari → Teilen → "Zum Home-Bildschirm" → öffnet als App im Vollbild.

### 4. Mobil optimiert
- Login, Willkommen, Dashboard, QR-Modal — alle im iPhone-Viewport (390px) getestet, sauber.

---

## 📱 So testest du (iPhone, Safari)

**Komplette App:**
`https://qr-voucher-customer-app.vercel.app`
→ einloggen → GO → Erstellen → Meine Aktionen → QR antippen → Pass.

**Nur die Wallet-Pässe schnell testen:**
`https://qr-voucher-customer-app.vercel.app/pass-test`
→ Buttons für Demo-Gutschein + Stempelkarten (5/10).

**App installieren:** Safari → Teilen-Symbol → "Zum Home-Bildschirm".

---

## ✨ UPDATE 02.06. (nach deinem Feedback)
- **iOS-Zoom beim Tippen behoben** (viewport maximum-scale + Input-Schrift 16px).
- **Lila Wiesbaden Logo** ist jetzt im Dashboard (oben links, statt "L").
- **Entwertung/Stempeln funktioniert** (neu gebaut + voll getestet):
  - Tab "Scanner": Kamera-QR-Scan ODER manuelle Code-Eingabe ("LILA-XXXXXX").
  - Gutschein: einmalig einlösen → 2. Scan wird blockiert ("bereits eingelöst").
  - Stempelkarte: jeder Scan +1; bei voll (z.B. 10/10) → 🎉 Belohnung + Karte startet neu bei 0.
  - Alles in der DB protokolliert (redemptions-Tabelle), Dashboard-Stats aktualisieren sich.
- **WICHTIGE EINSCHRÄNKUNG:** Der Stempelstand wird in der DB + im Dashboard korrekt hochgezählt,
  ABER die Zahl IM Wallet-Pass selbst (z.B. "3/10") aktualisiert sich noch NICHT automatisch.
  Das braucht Apple Push (APNs, .p8-Key) — das ist Phase 2 (siehe unten).

## ⚠️ Offene Punkte (für heute)

1. **Gutschein-DESIGN:** Dein `quer-gutschein.png` wurde kaputt gespeichert (war HTML statt Bild).
   Der Gutschein nutzt aktuell ein Übergangs-Design. **→ Speicher das Querformat-Gutschein-PNG
   nochmal richtig** (Rechtsklick → Bild speichern, in den lila-Ordner), dann update ich die
   Gutschein-Optik in 1 Minute. Die 2 **Stempelkarten-Designs (5x + 10x) sind perfekt drin.**

2. **Stempeln (+1) noch nicht gebaut:** Der Scanner im Dashboard erkennt QR, aber das
   tatsächliche Hochzählen eines Stempels + Wallet-Update (via Apple Push) ist der nächste Schritt.

3. **Test-Kampagnen in der DB:** Beim Testen sind 1-2 Duplikate entstanden ("10% Rabatt" 2x).
   Kann ich auf dein OK wegräumen (DB-Löschung brauchte deine Erlaubnis).

4. **Multi-Tenant-Design:** Aktuell ist das lila.-Design fest verdrahtet. Für weitere Kunden
   müsste pro Betrieb ein Design hinterlegt werden (Ausbaustufe, sauber machbar).

---

## 🔜 Nächste sinnvolle Schritte (deine Entscheidung)
1. Gutschein-Design final (du speicherst PNG neu)
2. Stempeln (+1) via Scanner + Pass-Update (APNs / .p8 Push-Key)
3. Test-Daten aufräumen
4. Google Wallet zusätzlich

---

**Technik-Notiz:** Pass-Signing via `passkit-generator` (pure JS, serverless-tauglich).
Assets vorgeneriert in `api/_assets/<variante>/`. Neu generieren mit:
`node scripts/gen-assets.mjs` (nachdem ein neues Design im lila-Ordner liegt).

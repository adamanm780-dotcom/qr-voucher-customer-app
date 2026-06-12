# QR Voucher / Wallet Plattform — Roadmap

**Kunde Nr. 1:** Lila Wiesbaden
**Reboot:** 31.05.2026 (mit Opus 4.8)
**Prinzip:** Meilenstein für Meilenstein. Kernfunktion zuerst, jeder Schritt auf echtem iPhone getestet, bevor weitergebaut wird. (Lehre aus "Woche 1": keine Architektur auf Vorrat.)

---

## ✅ Meilenstein 0 — Signierter Pass in Apple Wallet (ERLEDIGT 31.05.2026)
- Zertifikat-Kette komplett (Pass Type ID + Private Key + WWDR G4) bis Apple Root CA
- Echte PKCS#7-Signatur (kein Mock mehr)
- Pass per Vercel-URL + QR-Scan in echte Apple Wallet importiert ✅
- Details: siehe Projektgedächtnis `apple-pass-signing-setup.md`

---

## 🔜 Phase 1 — Web-App, Kernfunktion (AKTUELL)
**Entscheidung:** Web-App / PWA zuerst. Läuft auf iPhone + Android, kein Mac, kein App-Store-Review, sofort updatebar. Wallet-Integration identisch zur nativen App.

- [ ] Landingpage fixen (alter server.js raus, sauberes Setup)
- [ ] Backend/Datenbank wählen + einrichten
- [ ] Login für Betriebe
- [ ] Dashboard: Historie + "Gutscheine im Umlauf"
- [ ] Gutschein erstellen → dynamischer QR → Pass
- [ ] Stempelkarte erstellen (NEU) → Wallet
- [ ] Entwerten + Erfassen (Kamera-Scan im Laden)
- [ ] Google Wallet zusätzlich zu Apple

---

## 🎯 ZUKUNFTSZIEL — Eigene native App im App Store (WICHTIG für den User)
> Dem User ist eine **eigene App im Apple App Store** persönlich wichtig — als Aushängeschild.
> Reihenfolge bestätigt: ERST komplette, perfektionierte Web-App → DANN App Store.
> Plan: Web-App-Logik bleibt das Backend; native Hülle greift auf dieselben APIs zu.
> App-Store-Präsenz = Aufsatz, kein Neubau.
> ✅ Apple Developer Program ist bereits GEKAUFT (eine Voraussetzung schon erfüllt).
> Verbleibend für den App-Store-Schritt: Mac + Xcode (Mac vom Vater leihbar), Review-Prozess einplanen.

---

## Festgelegte Produkt-Entscheidungen (31.05.2026)
- **App-Typ Phase 1:** Web-App / PWA (iPhone + Android, kein Mac, sofort updatebar)
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Stempel-Methode:** Weg A — Betrieb scannt den QR der Mitglieds-Karte und gibt +1 (fälschungssicher)
- **Karte voll (z.B. 10/10):** wird automatisch zu Gratis-Gutschein, den der Betrieb wie einen normalen Gutschein entwertet; Karte startet danach neu bei 0
- **Zwei Wallet-Objekttypen:** Gutschein (coupon, einmalig entwerten) + Stempelkarte (storeCard, zählt hoch, braucht Pass-Updates via APNs/.p8)
- **Mitglieder-Onboarding:** Dauer-QR (gedruckt am Tresen) → Mitglied scannt selbst → leere Stempelkarte (0/x) landet in Wallet. Kein Registrieren nötig.
- **+1 Stempel:** ausschließlich über das Betriebs-Dashboard (Betrieb scannt Mitglieds-Karte). Trennung = fälschungssicher.
- **Architektur:** echtes Multi-Tenant von Anfang an (beliebig viele Betriebe, jeder sieht nur seine Daten). Einmal bauen → an viele Agentur-Kunden verkaufen.

---

## Tech-Stand
- Frontend: Vanilla HTML/CSS/JS (später ggf. strukturierter)
- Hosting: Vercel (Account: adamanm780-dotcom, Projekt: qr-voucher-customer-app)
- Live: https://qr-voucher-customer-app.vercel.app
- Apple: Pass Type ID `pass.com.lila.gutschein`, Team `4X4Z2XA87V`, Account bebopeti@icloud.com

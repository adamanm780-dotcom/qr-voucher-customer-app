# 🤝 ÜBERGABE-KONTEXT — FlowState Wallet (für neue Session)

> Älterer Stand: 21.06.2026. **AKTUELLER STAND siehe direkt unten (28.06.2026).** In einer neuen Session: **„Lies HANDOFF-KONTEXT.md im Projektordner und mach dort weiter."**

---

## ⭐ STAND 28.06.2026 (Abend) — GOOGLE WALLET gebaut & live (gated) — zuerst lesen!

**Google-Wallet-Integration ist vollständig gebaut, deployed & live verifiziert.** Apple-Pfad unverändert (kein Regress, live geprüft: `/api/pass?demo=stamp10` → `application/vnd.apple.pkpass`).

**Neuer Flow:** Dashboard-QR zeigt jetzt auf **`/api/card`** (Dispatcher) statt direkt `/api/pass`. Der Dispatcher erkennt das OS per User-Agent: **iPhone → 302 auf Apple-`/api/pass`** (wie immer), **Android → „In Google Wallet"-Landing** (Save-Link), Desktop → Hinweis. Live getestet (alle 3 Pfade ok). Alte gedruckte Apple-QRs (`/api/pass`) laufen weiter.

**Neue Dateien:** `api/_google.mjs` (dependency-frei: RS256-Save-JWT + OAuth2-SA-Token + GenericClass/Object via REST), `lib/googleview.mjs` (GenericObject aus `cardView()` → Apple & Google nie divergent), `lib/mint.mjs` (geteilte Mint-Logik, aus `pass.mjs` herausgezogen — Apple identisch + Drossel greift auf Google-Pfad), `api/card.mjs` (Dispatcher), `lib/walletpush.mjs` (`notifyWallets()` = APNs **und** Google-Patch beim Stempeln; `redeem.mjs` ruft das jetzt). `db/google-wallet.sql` (Spalte `passes.google_object_id`). `GOOGLE-WALLET-SETUP.md` (Klick-Anleitung). Design-Spec + Plan unter `docs/superpowers/`.
- Hero-Bild = bestehendes Strip-Design des Betriebs direkt (sharp-Resize verworfen — natives Binary sprengt das 250-MB-Function-Limit). Stempelzahl läuft als **eigenes Live-Textfeld** (`3/10`), unabhängig vom Bild.
- 5 Offline-Tests grün (`scripts/test-mint|google-jwt|googleview|wallet-target.mjs`), alle Module laden sauber.

**❗ ZUM SCHARFSCHALTEN (Android) fehlen NUR 2 User-Aktionen** (alles andere ist fertig & inaktiv ohne Crash):
1. **Migration anwenden:** `db/google-wallet.sql` im Supabase-SQL-Editor (Projekt „voucher flow") ausführen. (Supabase-JS kann kein DDL.)
2. **Google-Credentials holen** per `GOOGLE-WALLET-SETUP.md` → 2 Env-Vars in Vercel setzen (`GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON_B64`) → neu deployen. ⏳ Issuer-Freigabe dauert ggf. Tage.

Solange Schritt 2 offen ist: Android zeigt freundlich „Google Wallet kommt in Kürze", iPhone unverändert. Danach: Android-Karte + Live-Stempel-Update automatisch (Code steht, `notifyWallets` patcht Google bei jedem Stempel).

**Noch nicht live-getestet:** echter Android-Save + echtes Live-Stempel-Update (brauchen Credentials). Empfehlung: nach Schritt 1+2 einmal auf echtem Android durchspielen.

**Git:** Diese Session NICHT committet (Working-Tree voll mit unfertigen Assets aus Vorsessions) — Deploy kam aus dem Ordner. Google-Wallet-Dateien chirurgisch committen, wenn gewünscht.

---

## ⭐ STAND 28.06.2026 — was zuletzt lief (zuerst lesen!)

**Live & funktioniert** (https://qr-voucher-customer-app.vercel.app). Deploy IMMER aus dem Ordner: `cd <projekt> && npx vercel --prod --yes` und dann **`npx vercel promote <neue-deploy-url> --yes`** — WICHTIG: nach einem früheren `vercel rollback` ist Production „eingefroren", ein neuer `--prod`-Deploy übernimmt die Haupt-Domain NICHT automatisch → immer `promote` hinterher (oder es kommt „already current" = passt auch). Live-Check per `curl …/dashboard.html | grep <marker>`.

**Diese Session umgesetzt (alles live, Dashboard = `public/dashboard.html`, Login = `public/index.html`):**
- **Design-Richtung final = DUNKEL** (heller v17-Versuch wurde verworfen → per `<style media="not all">` deaktiviert). Übersicht komplett neu nach Referenz `dngynfd.png` umgebaut = Layer **v18** (`.ov2.ov3`-Wrapper): fette „Balance"-Hero-Karte mit Riesen-Zahl (Karten im Umlauf) + 3 integrierte Actions (QR ausgeben · zentraler Scan-FAB · Verwalten) + Hint-Zeile, Gäste-Avatarreihe, KPI-Kacheln, Chart+Aktivität zweispaltig. **Solide Karten (KEIN Glas-Blur — User fand Glas „vibe-coded").** Hero leicht indigo getönt („gesplittet" wie dngynfd).
- **GO/Welcome**: Welcome bleibt UNSER Design (dunkel, „Herzlich willkommen, {Betrieb}", zentriert). NUR das **GO-Feature** von `unbenannt.png` übernommen: Kapsel mit Doppelpfeil ^^ + weißer „Go"-Kreis unten am Daumen; **echtes Ziehen nach oben** (reine Pointer-Events + requestAnimationFrame + `touch-action:none` → flüssig, kein Flackern; Tap geht auch). Kein Teal mehr.
- **Echtes Karten-Design** im „Deine Karten"-Strip: zeigt das reale Apple-Wallet-Strip-Bild pro Aktion via `/api/card-image?campaign=<id>` (nur LIVE testbar; lokaler python-Server hat keine API → Fallback-Verlaufskarte). Strip = flex-wrap, `.o3-realcard`.
- **Aktionen löschen**: 🗑 in „Meine Aktionen" → `campaigns.delete()` (tenant-scoped `.eq('business_id',biz.id)`), FK-Fallback `update active=false`; loadCampaigns filtert `.eq('active',true)`.
- **Neues App-Icon**: User-generiert (ChatGPT), Quelle `C:\Users\maykt\Downloads\socialmedia\appicon\flowset_wallet_app_icon_final.png` (nur 237px!). Per PIL randlos zugeschnitten → alle Größen `public/icons/icon-{120..512}.png` + `maskable-512.png` ersetzt. **Wenn User 1024px-Export liefert → 512er neu generieren (aktuell leicht weich).**
- **Splash + Lade-Animation**: `public/index.html` hat `#splash` (verdeckt Login-Blitz bei aktiver Session → leitet weiter; sonst Login). Beide Ladescreens (`#splash` + Dashboard `#loading`) = **freigestelltes „F"** (`/assets/f-mark.png`, weiß/transparent, aus dem Icon extrahiert) + weicher Indigo-Glow-Halo + drehender Lade-Ring (conic-mask) + „FLOWSTATE". Min-Anzeigedauer ~1,4–1,5s.
- **Verifikation diese Session:** lokaler Server `python -m http.server 8123 --directory public` + MCP-Playwright (390×844 mobil / 1440 desktop), Login `cinnamood-8f6@kunden.flowstate.app` / `Cinna-326M`. Cache-Buster `?v=` nutzen; bei „stale" Service-Worker deregistrieren.

**Rollback (dunkel, vor v18-Umbau) = Vercel dpl `ofzxf0w1z`** (`npx vercel rollback <url> --yes`).

**User-Standing-Regeln:** (1) Nichts Gebautes rückbauen. (2) **Cyber-Security MUSS immer erhalten bleiben & bei jeder Änderung mitgepflegt werden** (tenant-scoping, kein innerHTML mit User-Daten, keine offenen Endpoints). (3) Verbotene Farben: Teal/Cyan, Gold, Grün, Lila-auf-Weiß. (4) Antworten auf Deutsch, Tempo, weniger Rückfragen, immer live deployen + Screenshots.

## 🎯 NÄCHSTE SCHRITTE (Reihenfolge vom User)
**1) Google Wallet-Integration** ✅ **GEBAUT & LIVE (gated) — siehe Stand 28.06. Abend oben. Nur noch: Migration + Credentials.** (Ursprüngliche Notiz unten als Referenz):
   - User muss bereitstellen: Google-Cloud-Projekt + Google Wallet API aktivieren + Service-Account (JSON-Key) + Wallet-**Issuer-ID** (Freigabe durch Google, dauert ggf. Tage).
   - Bauen (dependency-frei, analog `_apns.mjs`/`theme.mjs`): Loyalty/Generic-Class + Object definieren, **RS256-signierter JWT** „Save to Google Wallet"-Link (`https://pay.google.com/gp/v/save/<jwt>`). Karten-Optik aus `lib/theme.mjs` (color_bg/color_text/strip) übernehmen.
   - Flow: Gast scannt QR → Plattform erkennt Android → „In Google Wallet" Button/Link; **„Auto-Öffnen nach Hinzufügen": ein Tap auf den Save-Link öffnet die Google-Wallet-App** (vollautomatisch ohne Tap ist durch Browser-Security NICHT möglich — so kommunizieren).
   - Sicherheit mitnehmen: Mint-Drossel/Token-Logik wie bei Apple-Pfad.

**2) Apple App Store** (danach): Capacitor-Hülle um die Web-App (lädt Live-Inhalte von Vercel → Frontend-Änderungen bleiben ohne Store-Update sofort live; nur native Hülle/Listing braucht Review). Apple Developer **hat der User bereits** (99$/J). Store-Assets aus neuem App-Icon ableiten.

**3) Google Play Store** (zuletzt, **Anfang nächster Monat wenn Budget da** — Play-Console 25$ einmalig): damit auch Betriebe mit NUR Android-Geräten die App offiziell installieren können. **Hinweis/Zwischenlösung:** Android-Betriebe können die App schon JETZT als **PWA** nutzen (Chrome → „Zum Startbildschirm hinzufügen") — Play Store ist die offizielle/auffindbare Version, blockiert aber nichts in der Zwischenzeit. Reihenfolge bestätigt vom User: Google Wallet → Apple Store → (nächster Monat) Google Play.

---

## 0) Worum geht's
**FlowState Wallet** = Multi-Tenant SaaS: Betriebe (Cafés, Bäcker, Gyms…) geben digitale **Stempelkarten/Gutscheine** aus, die in **Apple Wallet** landen. Endkunden scannen QR → Karte in Wallet. Betrieb stempelt/entwertet via Scanner. Wird an Firmen verkauft (5–10k €/Mo, Ziel: Millionen-Umsatz). **Premium-Anspruch ist KRITISCH.**

## 1) Zugang, Pfade, Deploy
- **Projektordner:** `C:\Users\maykt\Downloads\qr-voucher-customer-app`
- **Live:** https://qr-voucher-customer-app.vercel.app  (Login `/`, Dashboard `/dashboard`, Admin-Cockpit `/cockpit`)
- **Git:** github.com/adamanm780-dotcom/qr-voucher-customer-app (`origin/main`). **Deploy kommt aus dem ORDNER, nicht aus Git:** `npx vercel --prod --yes`.
- **Tech:** Vanilla HTML/CSS/JS (kein Build) + Vercel Serverless (`api/*.mjs`) + Supabase (Postgres/Auth/Storage, Projekt „voucher flow" `uyqjaasrnqkvuhgtnjbj`, EU/London). Secrets in `.env` (lokal, gitignored) + Vercel Env-Vars.
- **Logins zum Testen:**
  - Betrieb: `cinnamood-8f6@kunden.flowstate.app` / `Cinna-326M`
  - Cockpit (Admin/du): `admin@flowstate.app` / `Flowstate2026`
  - Kunden-Passwort neu setzen: 🔑-Knopf im Cockpit (oder `scripts/set-...`).
- **IG-Scraping-Account:** `C:\Users\maykt\flowstate-brain\.env` → `IG_USERNAME=jarvis.swarm`.

## 2) ⚠️ DESIGN — das Wichtigste (hier lagen die Probleme)
Der User war **sehr unzufrieden** mit dem Frontend. Es MUSS sich **premium** anfühlen (Kunden mit >300k Einkommen, „private-jet-Niveau"). Lange Schleife, weil ich nur **umgefärbt** statt **Struktur/Material** geändert habe.

**Der User gab 5 Referenz-Designs. Sein Geschmack (WICHTIG, nicht raten!):**
- **#1 Wallet-App (Nina Skrbic):** hell-lavendel, **runde chunky Karten mit weichen Schatten**, riesige **Bold-Sans-Zahl**, Pillen-Buttons.
- **#2 Proton Pass (DIE Referenz):** **monochrom dunkel (schwarz/grau/weiß/silber)**, **dunkle Glas-Boxen** (Glassmorphism, milchig, Glanzkante), **glänzend-weiße Pillen-Buttons** (kein Farb-Akzent), glossy Icons.
- #3 PathFinders (foto, sage), #4 the Juice (navy), #5 florest (grün) — weniger gewichten.

**KLARE ABLEHNUNGEN des Users (NICHT wieder benutzen):**
- ❌ **Teal** = „Tech/vibe-coded"
- ❌ **Gold** = „fake-premium, das setzen Leute drauf die nicht premium SIND"
- ❌ **Grün** = explizit „mach die verdammte grüne Farbe weg" (letzte Anweisung)
- ❌ **Serif** (Fraunces) traf's nicht
- ❌ flach/scharf/randlos/austere
- ❌ Nur Farbe ändern statt **Ansicht/Material**

**LETZTE EXPLIZITE ANWEISUNG (befolgt, aktueller Stand v9):** „Mach es wie Proton Pass" → **monochrom**, **Glas-Boxen**, **glänzend weiß**, **kein Grün**. Plus: **Mobile-Ansicht immer mitliefern** (Screenshots Desktop + Handy).

### Aktueller Design-Stand (live, v9)
- **Monochrom Proton-Pass-Glassmorphism**: near-black `#09090b`, atmosphärischer BG (neutrale weiße Light-Blooms via `body::before`), **dunkle Glas-Karten** (`backdrop-filter:blur`, vertikaler Glanz-Gradient, helle Oberkante), **glänzend-weiße Pillen-Buttons** (weiß→`#e4e4e9` Gradient + inset highlight), **weißer** Chart/Akzent, **kein Grün**.
- **Layout neu (nicht nur Farbe):** Hero-Glaskarte „Karten im Umlauf" mit Riesen-Bold-Sans-Zahl + „live"-Badge → Glas-Chart-Karte → **KPI-Glas-Kachel-Raster** → Glas-Aktivitätsreihen. Font: **Plus Jakarta Sans**.
- Verifiziert Desktop + Mobile. Screenshots in `_shots/` (zuletzt `mono-desktop.png`, `glass-mobile.png`).

### ⚠️ Technische Schuld im CSS (unbedingt wissen!)
`public/dashboard.html`, `index.html`, `cockpit.html` haben **gestapelte `<style>`-Override-Blöcke (v2…v9)** vor `</head>` — jede Iteration legte einen neuen Layer mit `!important` drüber. **Das ist unsauber.** Empfehlung für die neue Session: **die alten v2–v8-Blöcke entfernen und EINEN sauberen Stylesheet schreiben** (v9 ist die gewünschte Richtung). Markup-IDs/Klassen, die das JS nutzt, MÜSSEN erhalten bleiben (statActive, activityChart, chartTotal, activityList, .nav[data-page], .page.active, .seg button.on, #goBtn, #welcome, .item, etc.). Überblick-Markup nutzt `ov-*`/`glasscard`-Klassen.

### So testet man das Design lokal (Vercel-Preview ist Auth-gesperrt!)
- Mini-Static-Server (Dashboard lädt Daten direkt aus Supabase): kleines Node-Skript `public/` auf Port serven, dann Playwright `localhost:<port>` → Login → GO → Screenshot Desktop **und** Mobile (390×844).
- **Browser-Cache ist ein RIESEN-Problem:** der User sah oft die ALTE Version. Immer sagen: **Inkognito-Fenster** oder **Strg+Shift+R**. Nach jedem Deploy live verifizieren (curl auf Markerstring).
- Playwright-MCP-Browser hängt sich manchmal auf („Browser already in use") → stale chrome killen: PowerShell `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ? CommandLine -like '*ms-playwright-mcp*' | % { Stop-Process -Id $_.ProcessId -Force }`.

## 3) Features — FERTIG & live (Funktion ist gut, nur Design war das Problem)
- **Security gehärtet:** Mint-Drossel (`api/pass.mjs` `campaignMintAllowed`), CORS-Allowlist, timing-sicherer Admin-Key, Fehler-Leaks raus, **Stored-XSS-Fix** (dashboard logo_url), `lib/security.mjs`.
- **Login-Sperre:** 3 Fehlversuche→5 Min→1 Versuch→„anrufen 0176 45289172". Auto-Reset nach 30 Min. Notfall-Link `…/cockpit?reset`. (`public/js/login-guard.js`)
- **Zugangsdaten-Knopf** (🔑) im Cockpit: `POST /api/admin/credentials` setzt neues Passwort + zeigt es (reset&reveal).
- **Eigener QR-Endpoint** `api/qr.mjs` (statt externem qrserver.com).
- **Backup:** `scripts/backup.mjs` (`backups/` gitignored). **Runbook:** `OPS-RUNBOOK.md`.
- **DSGVO-Entwürfe:** `legal/` (Datenschutz, AVV, Impressum) — anwaltlich prüfen.
- **IG-Profilbilder:** `scripts/set-ig-logo.mjs`. Methode: IG-Profilseite im Browser öffnen → Profilbild-URL aus DOM/og:image → in-Browser zu b64 fetchen (node-Download = 403!) → hochladen. **ERLEDIGT:** Cinnamood, Fried 90's, Café Hilda. **BLOCKER:** IG sperrt anonym nach ~5–10 Requests. Rest braucht eingeloggten Scraping-Account oder Handle-Liste. Build-Crop-Logo wurde abgestellt (`build-uploads.mjs`, commit 964ebdb).
- **Roadmap:** `ENTERPRISE-ROADMAP.md` (4 Säulen).

## 4) OFFENE Aufgaben (Reihenfolge ~ Priorität)
1. **DESIGN finalisieren** (oberste Prio): v9-Sprache (Proton-Monochrom-Glas) sauber durch ALLE Seiten ziehen (Erstellen, Scanner, Meine Aktionen, add.html, admin.html) + CSS aufräumen (alte Layer raus). Mobile immer prüfen.
2. **Android / Google Wallet** (größte Funktionslücke, gratis): nur Apple Wallet existiert. Braucht Google-Cloud-Projekt + Wallet-API + Service-Account + Issuer-Freigabe (dauert) vom User → dann Integration (crypto-RS256-JWT, dependency-frei wie `api/_apns.mjs`).
3. **Restliche IG-Profilbilder** (geparkt, „nicht so wichtig").
4. **Supabase Pro + Vercel Pro** (gegen Ausfall; kommt mit Budget nächsten Monat — Free-Tier = Ausfallrisiko).
5. **App Store** (Capacitor-Hülle), **Firmen-Integration** (Rollen/API/Reporting).

## 5) Arbeitsweise mit dem User
- Antworten auf **Deutsch**. User spricht teils Englisch (Mikrofon in VS Code).
- **Tempo, weniger Rückfragen** bei Routine. Aber bei großen Design-Richtungen EINMAL absichern + **immer Screenshots zeigen (Desktop+Mobile)** und **live deployen** (sonst sieht er nichts → Cache!).
- User arbeitet nachts, ist leistungsfähig, sehr ungeduldig bei Design. Nicht defensiv sein, Verantwortung übernehmen, liefern.

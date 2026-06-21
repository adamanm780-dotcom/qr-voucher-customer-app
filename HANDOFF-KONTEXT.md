# 🤝 ÜBERGABE-KONTEXT — FlowState Wallet (für neue Session)

> Stand: 21.06.2026. Dieses Dokument enthält ALLES, um nahtlos weiterzumachen. In einer neuen Session: **„Lies HANDOFF-KONTEXT.md im Projektordner und mach dort weiter."**

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

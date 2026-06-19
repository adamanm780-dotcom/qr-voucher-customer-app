# 📌 PROJEKT-KONTEXT — FlowState Wallet (Stempelkarten/Gutscheine in Apple Wallet)

> **Für jeden neuen Chat: ZUERST diese Datei + `.env` lesen. Dann hast du den vollen Kontext.**
> Stand: 13.06.2026. Sprache mit dem User: Deutsch.

---

## 1. Was ist das?
Multi-Tenant-Plattform (FlowState-Agentur). Betriebe (Cafés, Imbisse …) bekommen **Apple-Wallet-Stempelkarten** mit ihrem **eigenen Design**. Endkunden scannen einen QR → Karte landet in Apple Wallet → bei jedem Besuch +1 Stempel (live-Update via APNs). Voll → Belohnung.

**Geschäftsmodell:** FlowState pitcht Betrieben. Pro Betrieb: eigenes Design + Dashboard + Login. Alles über **EINEN** Apple-Developer-Account (Branding ist nur Daten im Pass).

## 2. Zugänge & Pfade
- **Projektordner:** `C:\Users\maykt\Downloads\qr-voucher-customer-app`
- **Live:** https://qr-voucher-customer-app.vercel.app
- **Deploy:** im Projektordner `npx vercel --prod --yes`
- **Supabase (RICHTIG/LIVE):** Projekt **„voucher flow"** = `uyqjaasrnqkvuhgtnjbj`. (NICHT „customer app" `nixioz…` — die ist leer/falsch.) URL+Keys in `.env`.
- **Apple:** Pass-Type-ID `pass.com.lila.gutschein`, Team `4X4Z2XA87V`. Zertifikate als verschlüsselte **Vercel-Env-Vars** (`APPLE_PASS_CERT_B64/KEY_B64/WWDR_B64`, APNs: `APPLE_APNS_KEY_B64/KEY_ID`, `APPLE_TEAM_ID`).
- **Admin-Cockpit:** https://qr-voucher-customer-app.vercel.app/cockpit · Login **`admin@flowstate.app` / `Flowstate2026`** (bleibt jetzt dauerhaft eingeloggt).
- **Lila-Demo-Login (Betrieb):** `lila@flowstate.app` / `Lila2026Test`. Demo-Pitch-Betrieb: `demo@flowstate.app` / `Demo2026!`.
- `.env` (gitignored) hat: SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY, OPENAI_API_KEY (Billing leer/429 → ungenutzt), APPLE_*.

## 3. Architektur (Vanilla, Vercel Serverless + Supabase)
**API (`api/`):**
- `pass.mjs` — erzeugt signierte `.pkpass`. `?enroll=<token>` (neue Karte) / `?campaign=<id>` / `?demo=`. Serial-Präfix aus Betriebs-Slug (NINI-…, LILA-… für Lila). Rate-Limit via `lib/security.mjs`.
- `v1.mjs` — Apple PassKit Web-Service (register/serials/getpass) → Live-Stempel-Update via APNs.
- `redeem.mjs` — Stempeln/Entwerten/Einlösen für alle 5 Mechaniken. **Auth-Pflicht:** Bearer-Token des eingeloggten Betriebs; prüft `pass.business_id ∈ owned` (kein Cross-Tenant!). **`{inspect:true}`-Modus (Phase 3): liest die Karte OHNE Mutation → liefert `card{label,title,business,remaining,unit,stamps,goal,validUntil,usable,reason,needsAmount,action}` für die Scanner-Vorschau.**
- `admin.mjs` — Cockpit-Backend (admin-gated via ENV `ADMIN_EMAILS`): `GET ping` (leichter Admin-Check fürs Login-Routing), `GET businesses` (PERF: alle Counts in 3 parallelen Queries + Tally im Code — NIE wieder pro Betrieb loopen!), `POST impersonate` (Magic-Link→Tokens), `POST delete-business` (Lila geschützt), `POST upload-design` (gibt `bytes` zurück, Client prüft das), `POST update-business` (Kartenkörper-Farbe `color_bg`+auto `color_text` live in DB, Lila geschützt — kein Deploy nötig), `GET/POST feedback`, `GET uploads`.
- `card-image.mjs` — Strip-PNG für Vorschau. Params: `?enroll=` / `?campaign=` / `?demo=` / `?business=<id>` (fürs Cockpit-Einstellungen-Panel: Strip über die erste Aktion des Betriebs).
- `_apns.mjs` — APNs-Push. **WICHTIG:** kein `apns-push-type:background`.
**Lib (`lib/`):**
- `theme.mjs` — `themeFor(biz)`, `assetKey`, `loadAssets`. Erkennt eigenen Design-Ordner `api/_assets/biz-<slug>-{stamp5|stamp10|coupon}` → Custom-Prefix; sonst `default-`; **Lila** (`lila-wiesbaden`) = Sonderpfad (unberührt lassen!). Bundling-fester ASSETS-Pfad.
- `security.mjs` — `campaignMintAllowed` (Rate-Limit), `setCors`.
- `passgen.mjs` — alt.
- `passview.mjs` — **EINZIGE QUELLE fürs Pass-Layout** (`cardView(camp,pass,theme,opts)` → style/structure/stripName). pass.mjs (Erstausgabe) UND v1.mjs (Live-Update) nutzen es → keine Divergenz mehr. **Bei neuen Mechaniken/Feldern NUR hier ändern.**
- `theme.mjs` zusätzlich: `campaignDir(slug,campId)` → **eigenes Design PRO AKTION** (Ordner `biz-<slug>-c<8>` falls vorhanden, sonst Fallback mechanik-gekoppelt). pass/v1/card-image lösen so erst pro-Aktion, dann pro-Betrieb auf.
- **ZEIT-PASS:** `campaigns.type='access'` mit `config.tage` (z. B. 7/3) = gültig **ab erstem Scan** für N Tage, mehrere Eintritte erlaubt, „TAG X/N" + „gültig bis", danach `expired`. Start = erster `entry`-redemption. (Ohne `tage` = klassischer Zugang feste Daten/einmalig.)
- `cards.mjs` — **Phase 2 SOT für Karten-MECHANIKEN** (stampcard/coupon/multipass/balance/access): `MECHANICS`, `isMechanic`, `initialRemaining(type,config)`, `withinValidity(config)`. `pass.mjs` (Pass-Felder + remaining-Init via `mintFor`) und `redeem.mjs` (Aktionen use/debit/entry, depleted/expired/insufficient/need_amount) bauen darauf. **MECHANICS-Liste auch clientseitig in `dashboard.html` gespiegelt (MECH) — synchron halten.**
**Frontend (`public/`):** `index.html` (Login→Admin ins Cockpit via `/api/admin/ping`, Betrieb ins Dashboard), `dashboard.html` (Betriebs-Dashboard: Erstellen/Aktionen/Scanner; „Letzte Aktivität" lädt echte redemptions inkl. Serial via `passes(serial)`-Join. **WICHTIG (14.06.): alle Dashboard-Queries [stats/campaigns/activity] sind HART auf `biz.id` gescoped — nicht nur RLS! Sonst Cross-Tenant-Leak [z. B. LILA-Serial im NINI-Dashboard]. Beim Erweitern immer `.eq('business_id',biz.id)` mitführen.**), `cockpit.html` (Admin — Suchfeld, SVG-Icons, Karten-Stagger, Betriebe-Cache in localStorage `fs_cockpit_cache`; pro Karte 3 Icons: 💬 Feedback / ⚙️ **Karte bearbeiten** / 🗑 Löschen. ⚙️ öffnet Einstellungen-Panel: Stempelkarte wie in Wallet [Strip via `/api/card-image?business=`] + voller Farbwähler für Kartenkörper, Live-Vorschau mit Auto-Textkontrast, Speichern→`update-business`→DB [kein Deploy]. Lila ohne ⚙️/🗑.), `add.html` (ungenutzt), `manifest.json`+`sw.js`+`icons/` (PWA).
**BRAND (13.06., einheitlich auf ALLEN Seiten):** Fonts Sora (Headings) + Manrope (Body) — NICHT mehr Space Grotesk/Inter/DejaVu. Farben: bg `#0a0d14`, Akzent Mint `#3ce8c4` → Blau `#4f7dff` (Gradient 100deg), KEIN Lila/Cyan-Regenbogen mehr. Icon: dunkles Premium-F (weiß + Mint→Blau-Mittelbalken) via `scripts/gen-app-icon.mjs`; transparentes Mark `assets/logo-mark.png` (ersetzt flowstate-logo.webp überall).

## 4. DB (Supabase) — wichtige Constraints
- `businesses`(id, owner_id, name, slug, logo_url, color_bg, color_text, **industry** [text, default `gastronomie`], **templates** [jsonb default `[]` — PERSONALISIERTE „Erstellen"-Vorlagen pro Betrieb; leer = Branchen-Fallback]). 
  - **Personalisierung (14.06.):** Betriebs-Dashboard „Erstellen" zeigt NUR `businesses.templates` des Betriebs (Galerie „Vorlagen für <Name>"), Fallback auf Branchen-Defaults nur wenn leer. Alte generischen Gastro/Lila-Gutscheinkacheln ENTFERNT, Platzhalter neutral. Access-Formular hat Feld „Gültig X Tage ab 1. Scan" (`config.tage`) für Zeit-Pässe. Template-Form: `{label,sub,mech,fill:{feldId:wert}}` ODER `{...,create:{type,title,value,config}}`. Fitness First templates gesetzt (7-Tage/3-Tage/Protein). **15.06.: 37 Gastro-Betriebe via Multi-Agent-Workflow (`scripts/personalize-dashboards`) recherchiert + je 4 markenspezifische Vorlagen gesetzt** (`scripts/apply-personalization.mjs` liest Workflow-Output `.result`, mappt → `fill`/`create`, Update via slug). 3 Karteileichen gelöscht (Café Schmidt, FlowState Demo, Fried-90's-Dublette); Nordsee-TEST ausgelassen. **OFFEN: Cockpit-Editor zum Pflegen von `templates` pro Betrieb (Skalierungs-Tool) — aktuell nur per Script setzbar.**
- `campaigns`(type, stamp_goal, reward, enroll_token, value, active, **config jsonb** [Phase 2]). **type seit 14.06.: `stampcard|coupon|multipass|balance|access`** (5 Mechaniken). `config` hält typ-spezifische Parameter: multipass `{max_uses}`, balance `{start_amount,unit}`, access `{valid_from,valid_until,repeat}`.
- `passes`(serial, business_id, campaign_id, stamps, auth_token, status, **remaining numeric** [Phase 2: Mehrfach-Einlösungen/Guthaben übrig]). **status: `active|redeemed|completed|depleted|expired`**.
- `redemptions`(action: `enroll|stamp|redeem|use|debit|entry`), `device_registrations`.
- **Storage-Buckets:** `design-uploads` (privat: pending/processed Uploads + `feedback/`), `brand-logos` (public: Profilbilder).
- RLS aktiv: owner sieht nur Eigenes. Service-Key (server) umgeht RLS.

## 5. DER UPLOAD-WORKFLOW (so entstehen neue Betriebe) — WICHTIGSTE ROUTINE
1. **User** im Cockpit: „＋ Design hochladen" → Name, 5/10, Datei → **„🔍 Design öffnen & Stempel setzen"** = Vollbild: Größe-Regler, dann **zieht die User die 5 gemalten Haken selbst auf die Kreise** → Fertig → Hochladen.
2. Bild (als **JPEG** komprimiert, sonst Body-Limit!) + Name + **positions[{x,y}]** + rfr landen in Supabase Storage `design-uploads/pending/<id>.{png,json}`.
3. **Monitor** `scripts/watch-uploads.mjs` (läuft als Hintergrund-Task) meldet `UPLOAD_READY <id>` und `FEEDBACK <id>`.
4. **Ich (Claude)** führe aus: `node scripts/build-uploads.mjs` → nimmt pending, nutzt **meta.positions** (vom User gesetzt!), baut Assets (`gen-business-assets.mjs` `fillOnly`), legt Betrieb+Login+5er-Kampagne an (`provision-custom.mjs`), **deployt automatisch**, verschiebt nach processed/.
5. Ich prüfe `api/_assets/biz-<slug>-stamp5/strip_5@3x.png` (voller Stand) per Read, dann fertig.

**Scripts (`scripts/`):**
- `build-uploads.mjs` — Haupt-Verarbeitung (nutzt meta.positions, auto-deploy).
- `gen-business-assets.mjs` — baut strip_0..goal. Modus **`fillOnly`**: Upload-Design als BG (**`contain`** = NICHTS abschneiden, Ränder in `colorBg`), nur **gemalte grüne Haken** (`paintedCheck`, gerade) an `stampPositions`. Auch `asIs`/Code-Design/OpenAI-Modi vorhanden.
- `provision-custom.mjs` — Betrieb+Login+Kampagne (exakter slug, idempotent).
- `peek-uploads.mjs` — falls User KEINE Positionen setzt: erzeugt `_peek-<id>.png` (Strip), ich messe per Raster/Ring-Overlay (Beispiel-Workflow in History) und schreibe `_brand/<id>-pos.json`.
- `watch-uploads.mjs` (Monitor), `feedback.mjs` (Notizen lesen/`done`), `gen-app-icon.mjs`.
- `diag-serials.mjs` — listet pro Betrieb die Serial-Präfixe vs. erwarteten Slug-Prefix (Korrektheits-Check). `fix-serials.mjs` — korrigiert falsche Präfixe bestehender Pässe (`LILA-XXXX`→`<SLUG>-XXXX`, Suffix/Stempel bleiben; Lila nie angefasst; Dry-Run default, `APPLY=1` schreibt). **14.06.: 42 Alt-Test-Pässe [LILA→eigener Prefix] korrigiert, alle 37 Betriebe jetzt sauber. Mint-Logik [pass.mjs newSerial(biz.slug)] war schon korrekt — die LILA-Codes waren Altlasten aus der Anfangszeit [vor dem Slug-Prefix].**

## 6. Design-/Stempel-Regeln (hart erkämpft!)
- **Strip = 1125×432 (@3x), Ratio 2.60.** User-Designs idealerweise **2.6:1** (z. B. 1300×500) → randlos. Andere Ratios: `contain` zeigt alles + farbgleiche Ränder (nichts abgeschnitten).
- **Haken: User platziert selbst** im Vollbild-Tool (pixelgenau). meta.positions sind Fraktionen des contain-Strips. **Platzier-Box & Strip nutzen denselben Modus (contain)** — sonst Versatz. Nach CSS-Änderungen: **Seite voll neu laden** (Cache!).
- **Haken-Höhe ist synchron:** Einen Haken vertikal ziehen verschiebt ALLE Haken auf dieselbe Höhe (X bleibt individuell). Größe via Slider gilt ebenfalls für alle. So gewollt (User-Wunsch 12.06.).
- **Designstreifen-Sicherung (13.06.):** Bild wird SOFORT bei Auswahl zu JPEG-DataURL konvertiert (`designB64`) + sichtbare Vorschau „✓ angehängt (xx KB)" im Modal; Submit prüft Mindestgröße, Server bestätigt `bytes`. Streifen kann nicht mehr fehlen.
- Gemalter, **gerader** grüner Haken (`paintedCheck`, rot=0).

## 6b. BUNDLE-GRÖSSE (kritisch, 13.06.) — Vercel Serverless max 250 MB!
`api/_assets/**` wird in pass/v1/card-image gebündelt. Bei ~34 Betrieben → 252 MB → **Deploys schlagen fehl** („exceeded 250 MB"). FIX: alle Strips als **Palette-PNG** (`sharp.png({palette:true,quality:82,effort:8,compressionLevel:9})`) → 61 MB. `gen-business-assets.mjs` macht das jetzt automatisch (Konstante `PAL`). Bei Re-Encode aller Assets: das Bulk-Skript-Muster aus History. **Wenn Deploy wegen Größe failt: Strips komprimieren.** Langfristig sauberer: Assets nach Supabase Storage + Runtime-Fetch (noch offen).
- **Karten-Farbe = unterer Design-Rand (auto, 13.06.):** `build-uploads.mjs` `bottomColor()` → color_bg = Farbe vom unteren 4%-Band des Designs (nahtloser Übergang Strip→Kartenkörper). color_text auto nach Helligkeit. Pro-Karte-Override per 💬 (z. B. „Farbe oben/das Dunkelrot"). color_bg wird LIVE aus DB gelesen → DB-Update reicht, kein Deploy.

## 7. Bekannte offene Punkte / Entscheidungen
- **Wallet-STAPELN:** Apple stapelt alle Karten (gleiche Pass-Type-ID) → im Stapel ist das Design ausgeblendet, erst beim Aufziehen sichtbar. **Einzeln nebeneinander geht NUR mit eigener Pass-Type-ID + Cert pro Betrieb** (manueller Apple-Schritt, GEPARKT). User weiß das. „Design nicht sichtbar"-Beschwerden = meist der Stapel.
- **OpenAI**: Key in .env, aber Billing 429 → Foto-Designs ungenutzt; Code/Upload-Designs sind der Weg.
- **Viele Test-Betriebe** in DB/Cockpit — User räumt mit 🗑 auf (Löschen klassifizierer-sensibel; Bulk-Delete braucht User-OK).
- **Sicherheits-Pass** wurde gemacht (security.mjs, redeem-Auth, Rate-Limit, CORS) — beibehalten.

## 7b. PLATTFORM-RICHTUNG (ab 14.06.) — vom Gastro-Loyalty zum universellen Wallet-Berechtigungs-System
Ziel: nicht nur Stempelkarten/Gutscheine für Gastro, sondern **Baukasten für digitale Berechtigungen/Benefits/Guthaben/Einlösungen** über viele Branchen (Mitarbeiterbenefits, Fitness, Beauty, Waschanlagen, Freizeit, Events, Vereine, Schulen…). Gastronomie bleibt der **erste vertikale Use-Case**, wird NICHT zerstört. Umsetzung in Phasen, **step-by-step, eine Phase pro Go** (User-Wunsch — nicht alles auf einmal):
- **Phase 1 (FERTIG 14.06.):** Branche/Nische-Fundament. `businesses.industry` + **Nischen-Umschalter oben im Admin-Cockpit** (nur belegte Nischen als Tabs + Zähler, wächst automatisch). Nische beim Anlegen (Upload-Dropdown `uIndustry`) + nachträglich im ⚙️-Panel (`set-industry`). Karten-Badge. **INDUSTRIES-Liste existiert ZWEIMAL und muss synchron bleiben: `api/admin.mjs` (Validierung) + `public/cockpit.html` (Labels/Tabs).** 12 Nischen: gastronomie, cafe, arbeitgeber, kantine, fitness, beauty, waschanlage, freizeit, event, verein, bildung, sonstige.
- **Phase 2 (FERTIG 14.06.):** Kartentyp-Baukasten. 5 Mechaniken (s. lib/cards.mjs + DB oben), `config jsonb`, `passes.remaining`. Betriebs-Dashboard: 5-Mechanik-Umschalter (`#mechSeg`, data-mech) + typ-spezifische Formulare; neue Mechaniken nutzen Dauer-QR (enroll_token). Scanner: Guthaben fragt Betrag (`need_amount`-Prompt). Migration `db/migrations/002_card_mechanics.sql`. End-to-End getestet via `scripts/test-mechanics.mjs` (12/12). **Upload-Pipeline bleibt Gastro-only — neue Nischen werden bewusst über den Dashboard-Create-Flow gebaut (User-Vorgabe).**
- **Phase 3 (FERTIG 14.06.):** universeller Scanner. Scan → `inspect` → Vorschau-Panel (`#cardPreview` in dashboard.html: Typ, Betrieb, Restwert/Gültigkeit, anstehende Aktion; Guthaben mit Betrags-Feld inline) → erst dann „Bestätigen" → `redeem`. Nicht nutzbare Karten (erschöpft/abgelaufen/schon eingelöst/fremd) zeigen Grund, kein Bestätigen. Tests: `scripts/test-inspect.mjs` (6/6) + UI verifiziert. Kein SQL nötig.
- **Phase 4 (FERTIG 14.06.):** Branchen-Vorlagen + Begriffe. Betriebs-Dashboard `dashboard.html`: `biz` lädt jetzt `industry`; Schnellstart-Vorlagen-Galerie (`#tplGallery`, `TEMPLATES`) gefiltert nach Branche → Klick befüllt die passende Mechanik-Form vor (oder erstellt Coupon direkt). Begriffe `TERMS` je Nische (Gäste/Mitglieder/Mitarbeiter/Besucher/Teilnehmer/Kunden) in Scanner-Lead + QR-Texten. **Verfügbare Mechaniken pro Nische über `MECH_BY_IND` (dashboard.html): GASTRONOMIE/Café = NUR `coupon`+`stampcard` (bewusst wie früher, kein Mehrfach/Guthaben/Zugang!); andere Nischen sehen nur ihre passenden Typen.** Kein SQL.
- **Pitch-Betrieb „Fitness First" (Wiesbaden, fitness):** Login `fitness-first-wiesbaden@kunden.flowstate.app` / `FitnessFirst2026!`, color_bg `#0a0a0c` (passend zum schwarzen Design). 3 echte Aktionen MIT eigenem Design (Streifen pro Aktion unter `api/_assets/biz-fitness-first-wiesbaden-c<8>/`, gebaut via `scripts/build-fitness-assets.mjs` aus den Designs in `C:\Users\maykt\Downloads\Fitness first dashboard\`): **7-Tage-Pass** (access tage:7), **3-Tage-Pass** (access tage:3), **Protein-Shake-Gutschein** (coupon). Mechanik 7/3-Tage: Karte bei Ausgabe **leer** (0 Kreuze, „startet mit 1. Scan"). Fenster startet mit dem **ERSTEN Scan** (erste `entry`-redemption, individuell pro Karte) → 1. Scan = sofort 1 Kreuz, danach +1 pro Kalendertag. Start NICHT created_at (war ein Zwischenstand, zurückgenommen). **Gemalte ROTE Kreuze**: progressive Strips `strip_0..N` (graue Design-Haken mit Box-Farbe #101010 überdeckt, dann roter X via `scripts/build-fitness-crosses.mjs`; Box-Positionen per Pixel-Messung; TAG-1..7-Mini-Labels dabei mit überdeckt — optional zurückholbar). `cardView` liefert `strip_<verstrichene Tage>`. **Täglicher Auto-Push:** `api/cron-timepass.mjs` (Vercel Cron `0 3 * * *` in vercel.json) pusht alle aktiven Zeit-Pässe → Kreuze wachsen ohne Scan; abgesichert über `CRON_SECRET` (in Vercel-Env gesetzt). Tests: `scripts/test-fitness.mjs` (4/4) + Cron 200/401. **Protein-Shake-Gutschein neu angelegt** (coupon, eigenes Design, enroll `25e2b0b1ed9968`, dir `…-cb5498c31`). FF hat jetzt 3 Aktionen: 7-Tage, 3-Tage, Protein-Gutschein.
- **Phase 5 (FERTIG 14.06.):** Dashboard-Auswertung. Übersicht jetzt 6 Kennzahlen (Im Umlauf, Eingelöst gesamt, Aktive Aktionen, **Karten ausgegeben, Einlösungen gesamt, Ø Einlösungen/Karte**) via erweitertem `loadStats`. **CSV-Export** der Einlösungen (`#exportBtn` → Blob-Download, UTF-8-BOM + Semikolon für Excel). Kein SQL.
- **Phase 6 (OFFEN, GROSS, braucht SQL):** Rollen & Mandanten — Standortleiter, Scanner-Nutzer, Arbeitgeber, Partner, Finanzrolle; mehrere Standorte/Logins pro Mandant sauber getrennt. Eigene DB-Tabellen (roles/locations/memberships) + Auth-Erweiterung + UI. Erst Scoping mit User (hängt von echtem Bedarf ab: Multi-Location-Kunden? reine Scanner-Logins?).
- **Wichtig:** Schema-Änderungen laufen über SQL-Snippets, die der User im Supabase-SQL-Editor ausführt (kein DB-Passwort/pg). Reads tolerant halten (`select('*')`), damit Deploy-Reihenfolge unkritisch ist.

## 8. Arbeitsweise mit dem User
- User lädt fortlaufend echte Pitch-Designs hoch; ich verarbeite jeden Upload (Monitor-Event → build-uploads). Hinweise/Verbesserungen kommen per 💬-Feedback (`feedback.mjs`).
- Direkt, schnell, ehrlich. Bei Fehlern: Ursache nennen, fixen, deployen, am echten Strip verifizieren (Read auf strip_5@3x.png). Lila NIE kaputtmachen.
- Unbeaufsichtigte Dauer-Loops (auto-provision/deploy) blockt der Safety-Classifier — pro Event einmal bauen ist ok.

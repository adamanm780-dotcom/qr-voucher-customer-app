# 📌 PROJEKT-KONTEXT — FlowState Wallet (Stempelkarten/Gutscheine in Apple Wallet)

> **Für jeden neuen Chat: ZUERST diese Datei + `.env` lesen. Dann hast du den vollen Kontext.**
> Stand: 12.06.2026. Sprache mit dem User: Deutsch.

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
- `redeem.mjs` — Stempeln/Entwerten. **Auth-Pflicht:** Bearer-Token des eingeloggten Betriebs; prüft `pass.business_id ∈ owned` (kein Cross-Tenant!).
- `admin.mjs` — Cockpit-Backend (admin-gated via ENV `ADMIN_EMAILS`): `GET businesses`, `POST impersonate` (Magic-Link→Tokens), `POST delete-business` (Lila geschützt), `POST upload-design`, `GET/POST feedback`, `GET uploads`.
- `card-image.mjs` — Strip-PNG zu einem Token (für Vorschau).
- `_apns.mjs` — APNs-Push. **WICHTIG:** kein `apns-push-type:background`.
**Lib (`lib/`):**
- `theme.mjs` — `themeFor(biz)`, `assetKey`, `loadAssets`. Erkennt eigenen Design-Ordner `api/_assets/biz-<slug>-{stamp5|stamp10|coupon}` → Custom-Prefix; sonst `default-`; **Lila** (`lila-wiesbaden`) = Sonderpfad (unberührt lassen!). Bundling-fester ASSETS-Pfad.
- `security.mjs` — `campaignMintAllowed` (Rate-Limit), `setCors`.
- `passgen.mjs` — alt.
**Frontend (`public/`):** `index.html` (Login→Admin ins Cockpit, Betrieb ins Dashboard), `dashboard.html` (Betriebs-Dashboard: Erstellen/Aktionen/Scanner), `cockpit.html` (Admin), `add.html` (ungenutzt), `manifest.json`+`sw.js`+`icons/` (PWA, neues vibrant F-Icon).

## 4. DB (Supabase) — wichtige Constraints
- `businesses`(id, owner_id, name, slug, logo_url, color_bg, color_text). 
- `campaigns`(type `coupon|stampcard`, stamp_goal, reward, enroll_token, value, active).
- `passes`(serial, business_id, campaign_id, stamps, auth_token, status). **status nur `active|redeemed|completed`!**
- `redemptions`(action nur `enroll|stamp|redeem`!), `device_registrations`.
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

## 6. Design-/Stempel-Regeln (hart erkämpft!)
- **Strip = 1125×432 (@3x), Ratio 2.60.** User-Designs idealerweise **2.6:1** (z. B. 1300×500) → randlos. Andere Ratios: `contain` zeigt alles + farbgleiche Ränder (nichts abgeschnitten).
- **Haken: User platziert selbst** im Vollbild-Tool (pixelgenau). meta.positions sind Fraktionen des contain-Strips. **Platzier-Box & Strip nutzen denselben Modus (contain)** — sonst Versatz. Nach CSS-Änderungen: **Seite voll neu laden** (Cache!).
- Gemalter, **gerader** grüner Haken (`paintedCheck`, rot=0).

## 7. Bekannte offene Punkte / Entscheidungen
- **Wallet-STAPELN:** Apple stapelt alle Karten (gleiche Pass-Type-ID) → im Stapel ist das Design ausgeblendet, erst beim Aufziehen sichtbar. **Einzeln nebeneinander geht NUR mit eigener Pass-Type-ID + Cert pro Betrieb** (manueller Apple-Schritt, GEPARKT). User weiß das. „Design nicht sichtbar"-Beschwerden = meist der Stapel.
- **OpenAI**: Key in .env, aber Billing 429 → Foto-Designs ungenutzt; Code/Upload-Designs sind der Weg.
- **Viele Test-Betriebe** in DB/Cockpit — User räumt mit 🗑 auf (Löschen klassifizierer-sensibel; Bulk-Delete braucht User-OK).
- **Sicherheits-Pass** wurde gemacht (security.mjs, redeem-Auth, Rate-Limit, CORS) — beibehalten.

## 8. Arbeitsweise mit dem User
- User lädt fortlaufend echte Pitch-Designs hoch; ich verarbeite jeden Upload (Monitor-Event → build-uploads). Hinweise/Verbesserungen kommen per 💬-Feedback (`feedback.mjs`).
- Direkt, schnell, ehrlich. Bei Fehlern: Ursache nennen, fixen, deployen, am echten Strip verifizieren (Read auf strip_5@3x.png). Lila NIE kaputtmachen.
- Unbeaufsichtigte Dauer-Loops (auto-provision/deploy) blockt der Safety-Classifier — pro Event einmal bauen ist ok.

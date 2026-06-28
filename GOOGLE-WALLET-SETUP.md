# Google Wallet einrichten (für FlowState Wallet)

Ziel: zwei Werte erzeugen — `GOOGLE_WALLET_ISSUER_ID` und `GOOGLE_WALLET_SA_JSON_B64` —
und in Vercel + lokale `.env` eintragen. Danach funktioniert Android automatisch.

> Hinweis: Bis das alles gesetzt ist, läuft alles unverändert weiter. iPhone ist nicht betroffen.
> Android-Gäste sehen so lange „Google Wallet kommt in Kürze".

## 0. Datenbank-Migration (einmalig, zuerst)
Im Supabase-Dashboard (Projekt **„voucher flow" `uyqjaasrnqkvuhgtnjbj`**) → SQL Editor →
Inhalt von `db/google-wallet.sql` einfügen → **Run**. (Fügt die Spalte `passes.google_object_id` hinzu.)

## 1. Google-Cloud-Projekt
1. https://console.cloud.google.com → oben Projektauswahl → **Neues Projekt** → Name z.B. „FlowState Wallet" → Erstellen.
2. Sicherstellen, dass das neue Projekt oben ausgewählt ist.

## 2. Google Wallet API aktivieren
1. https://console.cloud.google.com/apis/library → nach **Google Wallet API** suchen → **Aktivieren**.

## 3. Service-Account + JSON-Key
1. https://console.cloud.google.com/iam-admin/serviceaccounts → **Dienstkonto erstellen** →
   Name z.B. „wallet-signer" → Erstellen und fortfahren → (keine Rolle nötig) → Fertig.
2. Auf das Dienstkonto klicken → Tab **Schlüssel** → **Schlüssel hinzufügen** → **Neuen Schlüssel** →
   Typ **JSON** → die Datei wird heruntergeladen (z.B. `wallet-signer-xxxx.json`). **Gut aufbewahren.**
3. Die `client_email` aus dieser JSON merken (brauchen wir in Schritt 4 für die Berechtigung).

## 4. Google Pay & Wallet Console (Issuer-ID + Zugriff)
1. https://pay.google.com/business/console → mit demselben Google-Konto anmelden →
   **Google Wallet API** beantragen/onboarden (Firmendaten ausfüllen).
2. Nach Freigabe gibt es eine **Issuer-ID** (lange Zahl) → das ist `GOOGLE_WALLET_ISSUER_ID`.
   ⏳ Die Freigabe kann mehrere Tage dauern.
3. In der Wallet Console unter **Users / Zugriffsverwaltung** die `client_email` des Dienstkontos
   aus Schritt 3 als Nutzer mit Schreibrechten hinzufügen (damit der Server Karten anlegen darf).

## 5. JSON base64-kodieren
- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Pfad\zu\wallet-signer-xxxx.json"))
  ```
  Die ausgegebene lange Zeichenkette ist `GOOGLE_WALLET_SA_JSON_B64`.

## 6. Variablen eintragen
- **Lokal:** in `.env`:
  ```
  GOOGLE_WALLET_ISSUER_ID=3388000000022222222
  GOOGLE_WALLET_SA_JSON_B64=<lange-base64-zeichenkette>
  ```
- **Vercel:** Projekt → Settings → Environment Variables → beide Werte für **Production** anlegen.
- Danach neu deployen: `npx vercel --prod --yes` und `npx vercel promote <neue-url> --yes`.

## 7. Test
- Android-Handy: QR einer Aktion scannen → „In Google Wallet speichern" → ein Tipp → Karte ist drin.
- Im Laden stempeln → die Karte aktualisiert sich automatisch (3/10 → 4/10).

## Troubleshooting
- `npx vercel logs <url>` zeigt Fehler aus `card dispatch` / `gwallet patch`.
- Häufig: Dienstkonto fehlt der Zugriff in der Wallet Console (Schritt 4.3), oder `GOOGLE_WALLET_ISSUER_ID` falsch.
- Karte erscheint, aktualisiert sich aber nicht beim Stempeln: Migration (Schritt 0) vergessen → `passes.google_object_id` fehlt.

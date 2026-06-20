# OPS-Runbook — FlowState Wallet

> Was tun, wenn… Der Spickzettel für den Ernstfall. Stand: 21.06.2026.

## „Ist das System down?" — 30-Sekunden-Check
1. Öffne https://qr-voucher-customer-app.vercel.app — lädt die Startseite?
2. Test-Pass: https://qr-voucher-customer-app.vercel.app/api/pass?demo=stamp10 — lädt eine `.pkpass`?
3. Wenn beides lädt → System läuft. Problem liegt am Gerät/Netz des Nutzers.
4. Wenn nicht → Vercel-Status prüfen: https://www.vercel-status.com und Supabase: https://status.supabase.com

## Ich komme nicht ins Cockpit / ein Gerät hängt
- **Notfall-Entsperr-Link:** `https://qr-voucher-customer-app.vercel.app/cockpit?reset`
  → löscht jede Login-Sperre auf dem Gerät sofort. (Die Sperre löst sich sonst nach 30 Min selbst.)
- Sicherste Variante: in den Browser-Einstellungen die Website-Daten der Seite löschen.

## Letzten Deploy rückgängig machen (Rollback)
Wenn ein Deploy etwas kaputt gemacht hat — **sofort** zur letzten funktionierenden Version zurück:
1. `npx vercel ls --prod` → zeigt alle Deployments (oberster = aktuell).
2. Den vorherigen, funktionierenden Deployment-Link nehmen.
3. `npx vercel promote <deployment-url>` → macht ihn sofort wieder live (Sekunden, kein Build).
- Alternativ im Vercel-Dashboard → Deployments → „•••" → **Promote to Production**.

## Datenbank-Backup
- **Manuell jetzt:** `node scripts/backup.mjs` → lokale JSON unter `backups/` (NICHT in Git, enthält Kundendaten).
- **Mit Cloud-Kopie:** `node scripts/backup.mjs --upload` → zusätzlich in Storage-Bucket `backups`.
- **Empfehlung:** vor jeder größeren Änderung + 1× pro Woche. (Ab Supabase Pro zusätzlich automatische tägliche Backups.)
- **Wiederherstellen:** die JSON enthält alle Tabellen unter `data.<tabelle>`. Restore-Skript bauen wir, falls je nötig (besser: Supabase-Pro-PITR nutzen).

## Standard-Deploy
- `npx vercel --prod --yes` im Projektordner. Danach kurz den 30-Sekunden-Check oben machen.
- Code-Stand sichern: `git add -A && git commit && git push` (Repo: github.com/adamanm780-dotcom/qr-voucher-customer-app).

## Neuen Betrieb / Design aktivieren
1. Kunde lädt Design im Cockpit hoch („＋ Design hochladen").
2. `node scripts/build-uploads.mjs` → baut Karte + Betrieb + Deploy.
3. Zugangsdaten: im Cockpit auf der Kachel → 🔑-Knopf.

## Wichtige Fakten
- **Live-Code lebt im Ordner** `C:\Users\maykt\Downloads\qr-voucher-customer-app` + in Git (`origin/main`). Deploy kommt aus dem Ordner, nicht aus Git.
- **Secrets:** in Vercel Env-Vars + lokal in `.env` (NICHT in Git). Zertifikate in `certs/` (NICHT in Git).
- **Datenbank:** Supabase-Projekt „voucher flow" (`uyqjaasrnqkvuhgtnjbj`), Region EU/London.
- **Wallet:** aktuell nur Apple (iOS). Google Wallet (Android) ist in Arbeit — siehe [ENTERPRISE-ROADMAP.md](ENTERPRISE-ROADMAP.md).

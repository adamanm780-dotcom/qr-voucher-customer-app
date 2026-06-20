# FlowState Wallet — Enterprise-Roadmap

> Vom funktionierenden Prototyp zum verkaufsfähigen Produkt, das Firmen für **5–10k €/Monat pro Betrieb** in ihre Prozesse integrieren. Stand: 21.06.2026.

## Leitprinzipien
1. **Niemals Ausfall bei zahlenden Kunden.** Lieber ein Feature später als ein Produktionsausfall.
2. **Nichts blind ändern** — Staging testen, dann live. Jede Änderung rückrollbar.
3. **Reihenfolge: Fundament → Funktion → Politur.** Erst Zuverlässigkeit, dann Android, dann App Store.

## Ist-Zustand (geprüft 21.06.2026)
- **Stack:** Vercel Serverless (Node `.mjs`) + Supabase (Postgres + Auth + Storage) + `passkit-generator`. Frontend = Vanilla PWA.
- **Wallet:** nur **Apple Wallet (iOS)**. Apple-Signing + APNs-Live-Updates laufen. **Google Wallet (Android) = NICHT gebaut.**
- **App Store:** keine native Hülle — reine Web-App/PWA.
- **Multi-User:** **1 Login pro Betrieb**, keine Rollen.
- **Sicherheit:** Hardening-Pass erledigt (Mint-Drossel, RLS, CORS, XSS-Fix, Login-Sperre mit Selbst-Recovery). Service-Key serverseitig, `.env`/`certs` nicht in Git.
- **Datenstandort:** Supabase EU (London) ✓.
- **⚠️ Offen/zu prüfen:** aktueller Bezahl-Tier von Supabase & Vercel (Free-Tier = echtes Ausfallrisiko, s. Säule 1).

---

## SÄULE 1 — Zuverlässigkeit & Vertrauen *(FUNDAMENT, zuerst)*
> Bevor ein 10k-Kunde drauf ist, muss das hier stehen. Größtenteils schnell + günstig.

| # | Aufgabe | Wer | Aufwand | Kosten |
|---|---------|-----|---------|--------|
| 1.1 | **Infra-Audit:** aktuelle Tiers von Supabase & Vercel feststellen | DU zeigst Dashboard / ICH leite an | S | – |
| 1.2 | **Supabase Pro** — Free pausiert die DB bei Inaktivität + keine Backups → bei zahlenden Kunden No-Go. Pro = kein Pausing, tägl. Backups, mehr Compute | DU (Bezahlung), ICH konfiguriere | S | ~$25/Mo |
| 1.3 | **Vercel Pro** — Hobby ist für kommerzielle Nutzung laut ToS nicht erlaubt + hat Limits. Pro = höhere Limits, Team, Analytics | DU (Bezahlung) | S | ~$20/Mo |
| 1.4 | **Fehler-Monitoring (Sentry)** — Fehler in Functions + Frontend live sehen, *bevor* der Kunde sie merkt | ICH baue ein | M | Free→$26/Mo |
| 1.5 | **Staging-Umgebung** — Änderungen erst auf Test-Deploy, dann live (kein Risiko für Kunden) | ICH richte ein | M | – |
| 1.6 | **Automatische DB-Backups** — Supabase Pro tägl. + zusätzlicher wöchentl. Export nach Storage | ICH baue Skript | S | – |
| 1.7 | **DSGVO (Pflicht bei DE-Firmen):** AV-Vertrag (AVV), Datenschutzerklärung, Impressum. Datenstandort EU steht schon ✓ | ICH entwerfe, DU/Anwalt prüft | M | Anwalt opt. |
| 1.8 | **Account-Härtung:** 2FA auf Vercel/Supabase/Apple/Google, Zugriff minimal, Key-Rotation | DU | S | – |
| 1.9 | **Rollback-Plan dokumentiert** (Vercel Instant-Rollback) | ICH | S | – |

**Ergebnis:** Produkt fällt nicht aus, Fehler werden früh gesehen, rechtlich sauber für DE-Firmen.

---

## SÄULE 2 — Android / Google Wallet *(größte Funktionslücke)*
> Aktuell kann die **Hälfte** der Endkunden jedes Betriebs (Android) die Karte **gar nicht** nutzen. Größter Verkaufs-Blocker. Achtung: Issuer-Freigabe von Google **dauert** → früh starten.

| # | Aufgabe | Wer | Aufwand | Kosten |
|---|---------|-----|---------|--------|
| 2.1 | **Google Cloud Projekt + Wallet API aktivieren + Service-Account** | DU erstellst Google-Account, ICH leite Schritt-für-Schritt | M | – |
| 2.2 | **Google Wallet Issuer-Account beantragen** (Freigabe nötig, kann Tage dauern → SOFORT starten) | DU beantragst, ICH bereite Unterlagen | S + Wartezeit | – |
| 2.3 | **Pass-Klassen definieren** (Loyalty/Stempel + Gutschein) analog zu pass.json | ICH baue | M | – |
| 2.4 | **Backend: signierte „Save to Google Wallet"-Objekte** (JWT, Loyalty-Objekte mit Stempelstand) — neuer Endpoint `/api/gpass` | ICH baue | L | – |
| 2.5 | **Frontend: Geräte-Erkennung** → iOS zeigt Apple-Button, Android zeigt Google-Button | ICH baue | M | – |
| 2.6 | **Live-Updates für Android** (Google Wallet API PATCH statt APNs) — in redeem-Flow einhängen | ICH baue | L | – |
| 2.7 | **Stempel-Darstellung in Google Wallet** (anderes Modell: Loyalty-Points/Module/Hero-Image) gestalten | ICH | M | – |
| 2.8 | **Test auf echtem Android-Gerät** | DU/ICH | S | – |

**Ergebnis:** Jeder Endkunde — iOS **und** Android — bekommt die Karte. Verkaufsfähig für die volle Zielgruppe.

---

## SÄULE 3 — App Store (iOS + Android) *(Aushängeschild)*
> Native Hülle um die Web-App. Hauptwert: Store-Präsenz + native Politur. Web-App funktioniert auch ohne — daher **nach** Säule 1+2.

| # | Aufgabe | Wer | Aufwand | Kosten |
|---|---------|-----|---------|--------|
| 3.1 | **Web-App in Capacitor verpacken** (eine Codebasis → iOS + Android) | ICH baue | L | – |
| 3.2 | **iOS:** Icons/Splash, App Store Connect Listing, Screenshots, Privacy-Labels, Review | ICH baue, DU reichst ein | L | Apple-Acc ✓ (hast du) |
| 3.3 | **Android:** Google Play Console, AAB-Build, Listing, Review | DU erstellst Konto, ICH baue | L | $25 einmalig |
| 3.4 | **Mac für iOS-Build** (oder Cloud-Build via EAS) klären | DU | – | EAS opt. |

**Ergebnis:** „FlowState" als echte App im App Store + Play Store.

---

## SÄULE 4 — Firmen-Integration & Ausbau *(später, kundengetrieben)*
> Was die ersten Kunden für „in Prozesse integrieren" wirklich brauchen — Umfang nach echter Nachfrage.

| # | Aufgabe | Wer | Aufwand |
|---|---------|-----|---------|
| 4.1 | **Mehrere Mitarbeiter-Logins pro Betrieb + Rollen** (Inhaber/Personal) — Schema + Auth | ICH | L |
| 4.2 | **API + API-Keys pro Betrieb** (REST/Webhooks) zum Anbinden ihrer Systeme (CRM/Kasse) | ICH | L |
| 4.3 | **POS-/Kassen-Anbindung** (konkretes System je Kunde) | ICH | je nach System |
| 4.4 | **Self-Service-Onboarding/Branding** für Betriebe (statt Upload durch dich) | ICH | M |
| 4.5 | **Reporting & Export** (Umsatz, Einlösungen, CSV) | ICH | M |
| 4.6 | **Skalierungs-Review** (RLS + Performance bei vielen Mandanten) | ICH | M |

---

## Empfohlene Reihenfolge (Phasen)
- **Phase A — JETZT:** Säule 1 komplett (Upgrades + Monitoring + Staging + Backups + DSGVO-Entwürfe). Schnell, schützt die anstehenden Kunden.
- **Phase B — parallel sofort starten:** Säule 2.2 (Google Issuer-Antrag — gating!) anstoßen, dann Säule 2 voll bauen.
- **Phase C — kundengetrieben:** die Säule-4-Teile, die der erste zahlende Kunde für die Integration konkret braucht (meist 4.1 Rollen + 4.5 Reporting).
- **Phase D:** Säule 3 App Store, wenn die Web-App feature-komplett ist.

## Kostenüberblick (laufend, mtl.)
Supabase Pro ~$25 · Vercel Pro ~$20 · Sentry $0–26 · (Play Store $25 einmalig). **≈ 70–100 €/Monat** — verschwindend gering gegen 5–10k pro Kunde.

## Was ich SOFORT bauen kann (ohne dass du etwas zahlst)
- Fehler-Monitoring-Gerüst (Sentry Free)
- Staging-Setup + Rollback-Doku
- Wöchentliches Backup-Skript
- DSGVO-Entwürfe (Datenschutzerklärung, AVV, Impressum)
- Google-Wallet-Vorarbeit (Pass-Klassen + Endpoint-Gerüst), während die Issuer-Freigabe läuft

## Offene Entscheidungen für DICH
1. Supabase Pro + Vercel Pro freigeben? (Pflicht vor zahlenden Kunden)
2. Google-Account/Issuer-Antrag starten? (dauert → früh)
3. DSGVO: reicht mein Entwurf, oder soll ein Anwalt drüberschauen?
4. Mac vorhanden für iOS-Build, oder Cloud-Build (EAS)?

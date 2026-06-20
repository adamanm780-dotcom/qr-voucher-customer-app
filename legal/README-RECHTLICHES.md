# Rechtspaket FlowState Wallet — Übersicht & Anleitung

> ⚠️ **WICHTIG:** Das sind **fachlich fundierte Entwürfe**, keine Rechtsberatung. Vor dem produktiven Einsatz **von einem Anwalt / Datenschutzbeauftragten prüfen** lassen. Sie sind aber so weit vorbereitet, dass die Prüfung schnell + günstig wird.

## Was hier liegt
| Datei | Zweck | Wer braucht es |
|---|---|---|
| `datenschutzerklaerung.md` | Pflicht-Datenschutzerklärung (DSGVO Art. 13/14) | auf der Website/App sichtbar, für Endkunden + Betriebe |
| `impressum.md` | Impressum (§5 DDG / §18 MStV) | auf der Website sichtbar — Pflicht in DE |
| `auftragsverarbeitungsvertrag.md` | AVV (DSGVO Art. 28) — FlowState verarbeitet Daten **im Auftrag** der Betriebe | jeder zahlende Firmenkunde unterschreibt das |

## Rollen-Modell (wichtig fürs Verständnis)
- **Der Betrieb (euer Kunde) = Verantwortlicher** für die Daten seiner Mitglieder.
- **FlowState = Auftragsverarbeiter** — ihr verarbeitet diese Daten technisch in ihrem Auftrag. Darum gebt ihr jedem Betrieb einen **AVV**.
- **Eure Dienstleister = Unterauftragsverarbeiter** (Supabase, Vercel, Apple, Google). Die müssen im AVV gelistet sein (siehe unten).

## Was DU noch ausfüllen musst (alle `[PLATZHALTER]`)
1. **Firmendaten:** rechtlicher Name (Einzelunternehmen/GmbH?), Anschrift, E-Mail, ggf. USt-IdNr., Vertretungsberechtigter.
2. **Datenschutz-Kontakt:** E-Mail-Adresse für Datenschutzanfragen (z.B. datenschutz@flowstate…).
3. **Datenschutzbeauftragter:** nur Pflicht ab i.d.R. 20 Personen, die ständig Daten verarbeiten — bei euch aktuell vermutlich **nicht** nötig (im Dokument vermerkt).

## Aktuelle Unterauftragsverarbeiter (Stand 21.06.2026)
| Dienst | Zweck | Sitz / Datenstandort | Hinweis |
|---|---|---|---|
| **Supabase** (Datenbank, Auth, Storage) | Speicherung aller App-Daten | EU (London) | Haupt-Datenspeicher, EU ✓ |
| **Vercel** (Hosting) | Auslieferung der App/API | USA (Anbieter), EU-Edge | DPA + EU-SCC vorhanden; im AVV listen |
| **Apple** (Wallet / APNs) | Wallet-Pässe + Push-Updates (iOS) | USA | Geräte-Push-Token wird verarbeitet |
| **Google** (Wallet) | Wallet-Pässe (Android) — *in Vorbereitung* | USA/EU | erst aktiv listen, wenn live |

## Datenschutz-Fakten zum System (für die Anwaltsprüfung)
- **Sehr datensparsam:** Von Endkunden (Wallet-Nutzern) werden **keine Namen/E-Mails** gespeichert — nur eine Karten-Seriennummer, der Stempelstand und (bei iOS) ein Geräte-Push-Token für Updates.
- **Login der Betriebe:** E-Mail + Passwort (gehasht, via Supabase Auth).
- **Verlauf:** Stempel-/Einlöse-Historie pro Karte (ohne Personennamen).
- **Datenstandort:** EU (Supabase London). Zugriffsschutz per Row-Level-Security (jeder Betrieb sieht nur eigene Daten).
- **Externe Aufrufe:** QR-Bilder werden aktuell über `api.qrserver.com` erzeugt (die Karten-/Pass-URL geht dorthin) — sollte mittelfristig durch lokale QR-Erzeugung ersetzt werden (Hinweis fürs Team).

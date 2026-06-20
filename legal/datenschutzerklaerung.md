# Datenschutzerklärung — FlowState Wallet

> ⚠️ Entwurf nach DSGVO Art. 13/14. Vor Veröffentlichung `[PLATZHALTER]` ausfüllen und anwaltlich prüfen lassen.
> Stand: 21.06.2026

## 1. Verantwortlicher
Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:

[PLATZHALTER: Firma / Name]
[PLATZHALTER: Anschrift]
E-Mail: [PLATZHALTER: datenschutz@flowstate…]

Hinweis zum Rollen-Modell: Soweit ein Betrieb (Geschäftskunde) FlowState nutzt, um Treuekarten/Gutscheine für **seine** Mitglieder auszugeben, ist der **Betrieb** der Verantwortliche für die Daten seiner Mitglieder; FlowState handelt insoweit als **Auftragsverarbeiter** (siehe Auftragsverarbeitungsvertrag).

## 2. Datenschutzbeauftragter
Ein Datenschutzbeauftragter ist nur unter den Voraussetzungen des §38 BDSG verpflichtend (i.d.R. ab 20 ständig mit der Datenverarbeitung beschäftigten Personen). Aktuell ist dies **nicht** der Fall. [PLATZHALTER: anpassen, falls doch bestellt — dann Kontaktdaten hier.]

## 3. Welche Daten wir verarbeiten

### a) Geschäftskunden (Betriebe mit Login)
- **Kontodaten:** E-Mail-Adresse und Passwort (Passwort ausschließlich verschlüsselt/gehasht).
- **Betriebsdaten:** Name des Betriebs, Branche, Logo, Farben, angelegte Aktionen (Gutscheine/Stempelkarten).
- **Nutzungsdaten:** erstellte Karten, Einlösungen, Verlauf.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).

### b) Endkunden / Mitglieder (Wallet-Nutzer)
Wir sind **bewusst datensparsam**. Beim Hinzufügen einer Karte in Apple/Google Wallet verarbeiten wir:
- eine **Karten-Seriennummer** (zufällig erzeugt),
- den **Stempel-/Guthabenstand** und Einlöse-Verlauf,
- bei iOS einen **Geräte-Push-Token** (von Apple), um die Karte automatisch zu aktualisieren.

Wir speichern **keinen Namen, keine E-Mail und keine Telefonnummer** von Endkunden.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b und lit. f DSGVO (Vertrag/berechtigtes Interesse an der Bereitstellung und Aktualisierung der Karte).

### c) Server-Logdaten
Beim Aufruf der Anwendung verarbeitet unser Hosting-Dienstleister technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Ressource, Browsertyp) zur Auslieferung und Sicherheit.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Betrieb und Sicherheit der Plattform).

## 4. Empfänger / Auftragsverarbeiter
Wir setzen sorgfältig ausgewählte Dienstleister ein, mit denen Auftragsverarbeitungsverträge bestehen:

| Dienstleister | Zweck | Standort |
|---|---|---|
| Supabase | Datenbank, Authentifizierung, Datei-Speicher | EU (London) |
| Vercel | Hosting / Auslieferung der Anwendung | USA / EU-Edge |
| Apple | Apple Wallet & Push-Aktualisierung (iOS) | USA |
| Google | Google Wallet (Android) — *in Vorbereitung* | USA / EU |

Bei Übermittlungen in die USA stützen wir uns auf EU-Standardvertragsklauseln bzw. das EU-US Data Privacy Framework.

Hinweis: Zur Erzeugung von QR-Bildern wird derzeit der Dienst `api.qrserver.com` aufgerufen. [PLATZHALTER: entfernen, sobald QR-Erzeugung lokal erfolgt.]

## 5. Speicherdauer
Wir speichern Daten, solange das Konto/die Karte aktiv ist bzw. solange es für den Zweck erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Karten/Konten werden auf Anfrage gelöscht.

## 6. Ihre Rechte
Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Sie können sich zudem bei einer Aufsichtsbehörde beschweren (Art. 77).
Kontakt für alle Anliegen: [PLATZHALTER: datenschutz@flowstate…]

## 7. Keine automatisierte Entscheidungsfindung
Es findet keine automatisierte Entscheidungsfindung oder Profilbildung i.S.d. Art. 22 DSGVO statt.

## 8. Änderungen
Wir passen diese Datenschutzerklärung an, wenn sich die Verarbeitung ändert. Aktueller Stand: siehe Datum oben.

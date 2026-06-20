# Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO

> ⚠️ Entwurf/Muster. Vor Verwendung anwaltlich prüfen lassen und `[PLATZHALTER]` ausfüllen.
> Diesen Vertrag schließt FlowState mit **jedem Geschäftskunden (Betrieb)** ab.

## Zwischen

**Verantwortlichem** (der Betrieb / Geschäftskunde):
[PLATZHALTER: Name, Anschrift des Betriebs — wird pro Kunde ausgefüllt]
— nachfolgend „Auftraggeber" —

und

**Auftragsverarbeiter:**
[PLATZHALTER: FlowState — Firma, Anschrift]
— nachfolgend „Auftragnehmer" —

## §1 Gegenstand und Dauer
Der Auftragnehmer stellt eine Plattform zur Ausgabe und Verwaltung digitaler Treuekarten, Stempelkarten und Gutscheine (Apple/Google Wallet) bereit. Im Rahmen dieser Leistung verarbeitet der Auftragnehmer personenbezogene Daten im Auftrag des Auftraggebers. Die Dauer entspricht der Laufzeit des Hauptvertrags (Nutzungsvertrag der Plattform).

## §2 Art, Umfang, Zweck der Verarbeitung
- **Zweck:** Bereitstellung, Aktualisierung und Einlösung digitaler Karten/Gutscheine der Mitglieder des Auftraggebers.
- **Art der Daten:** Karten-Seriennummern, Stempel-/Guthabenstände, Einlöse-Verlauf, Geräte-Push-Token (iOS). **Keine** Klarnamen, E-Mails oder Telefonnummern von Mitgliedern.
- **Kategorien betroffener Personen:** Mitglieder/Endkunden des Auftraggebers.

## §3 Pflichten des Auftragnehmers
1. Verarbeitung nur auf dokumentierte Weisung des Auftraggebers (Art. 28 Abs. 3 lit. a).
2. Vertraulichkeit aller mit der Verarbeitung befassten Personen (Art. 28 Abs. 3 lit. b, Art. 29).
3. Technische und organisatorische Maßnahmen nach Art. 32 (siehe Anlage 1).
4. Unterstützung des Auftraggebers bei Betroffenenrechten und Meldepflichten (Art. 28 Abs. 3 lit. e/f).
5. Nach Vertragsende Löschung oder Rückgabe der Daten nach Wahl des Auftraggebers.
6. Bereitstellung aller erforderlichen Nachweise; Ermöglichung von Überprüfungen.
7. Unverzügliche Information bei Verdacht auf Datenschutzverletzungen.

## §4 Unterauftragsverarbeiter
Der Auftraggeber stimmt dem Einsatz folgender Unterauftragsverarbeiter zu:

| Dienstleister | Leistung | Standort |
|---|---|---|
| Supabase | Datenbank, Authentifizierung, Speicher | EU (London) |
| Vercel | Hosting / Auslieferung | USA / EU-Edge |
| Apple | Apple Wallet & Push (iOS) | USA |
| Google | Google Wallet (Android) — in Vorbereitung | USA / EU |

Der Auftragnehmer informiert über beabsichtigte Änderungen; der Auftraggeber kann widersprechen. Bei Drittlandübermittlung (USA) werden EU-Standardvertragsklauseln bzw. das EU-US Data Privacy Framework zugrunde gelegt.

## §5 Technische und organisatorische Maßnahmen (Anlage 1, Art. 32)
- **Zugriffskontrolle:** Row-Level-Security — jeder Betrieb sieht ausschließlich eigene Daten; serverseitiger Geheim-Schlüssel nie im Browser.
- **Authentifizierung:** Passwörter ausschließlich gehasht (Supabase Auth); Anmelde-Sperre gegen Brute-Force.
- **Verschlüsselung:** Transport per HTTPS/TLS; Datenbank- und Speicherverschlüsselung beim Anbieter.
- **Datensparsamkeit:** keine Klarnamen/Kontaktdaten von Endkunden.
- **Mandantentrennung:** logische Trennung pro Betrieb (owner_id + RLS).
- **Verfügbarkeit:** regelmäßige Backups; dokumentierter Rollback-Prozess.
- **Eingeschränkter Zugriff:** Zugriff auf produktive Systeme nur für berechtigte Personen.

## §6 Schlussbestimmungen
Es gilt deutsches Recht. Änderungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam.

Ort, Datum: ________________________

Auftraggeber: ________________________   Auftragnehmer: ________________________

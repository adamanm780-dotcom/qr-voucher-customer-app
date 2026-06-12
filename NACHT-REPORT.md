# 🌙 Nacht-Report — was über Nacht gemacht wurde

**Stand:** Nacht zum 07.06.2026 · alles live auf qr-voucher-customer-app.vercel.app

Du hast 6 Punkte genannt — hier was erledigt ist:

---

## ✅ 1. Grüne Haken füllen sich jetzt auf der Karte
Vorher: beim Scannen lief nur die Zahl „1/5" oben, die Karte selbst blieb leer.
Jetzt: Beim Stempeln erscheinen **grüne Haken direkt auf den Kreisen deines Designs**.
- Funktioniert über einen „Füll-Modus": dein Upload-Design bleibt, ich lege die Haken passgenau drauf.
- **Bestehende Betriebe wurden nachgerüstet** (6 Stück) — nicht nur neue.
- ⚠️ Die Haken-Positionen sind auf **dein ChatGPT-Template** (NINI/Hilda-Stil: 5 Kreise in einer Reihe) getunt. Wenn ein Design ein **anderes Layout** hat, sitzen die Haken evtl. leicht daneben. Lösung steht unten.

## ✅ 2. Profilbilder für JEDEN Betrieb
Jeder Betrieb hat jetzt ein Profilbild (quadratischer Ausschnitt aus dem Design, linke Seite wo meist das Logo sitzt) — im Dashboard-Avatar **und** als Wallet-Pass-Icon. Bestehende nachgerüstet.

## ✅ 3. Konfetti + „Zur Wallet hinzufügen" beim Scannen
Neue Seite **`/add`**: Wenn ein Gast den QR scannt, landet er auf einer Seite mit **🎉 Konfetti-Animation** + „Deine Stempelkarte ist da!" — und die Karte wird **automatisch zur Apple Wallet hinzugefügt** (plus großer Button als Fallback).
- Die QR-Codes im Dashboard zeigen jetzt auf diese Seite.

## ✅ 4. Karten klarer pro Betrieb (Wallet)
Jeder Pass trägt jetzt **den Markennamen oben** (logoText). Lila bleibt unverändert.
- ⚠️ **Ehrliche Grenze:** Apple Wallet stapelt Karten mit derselben „Pass-Type-ID". Wir nutzen bewusst EINE Pass-Type-ID für alle Betriebe (= ein Apple-Account, kein Setup pro Kunde). Für **komplett getrennte Stapel** bräuchte jeder Betrieb eine eigene Pass-Type-ID (mehrere Zertifikate unter deinem einen Account — machbar, aber mehr Verwaltung pro Kunde). **Deine Entscheidung** — sag mir, ob dir der Markenname + Farbe + eigenes Design reicht, oder ob wir die volle Trennung bauen.

## ✅ 5. Zoom in der App deaktiviert
Im Cockpit war Zoom noch möglich — jetzt überall aus. (Seite einmal neu laden.)

## ✅ 6. Dashboards löschen
Im Cockpit hat jede Kachel oben rechts ein **🗑** (mit Sicherheitsabfrage). Lila ist geschützt.

## 🔒 BONUS — kritischer Sicherheits-Bug behoben
Vorher konnte ein Betrieb **fremde** Karten entwerten (Fried scannt Lila → wurde entwertet). **Behoben:** jeder Betrieb kann nur noch SEINE eigenen Karten stempeln/einlösen. Getestet.

---

## 🧪 Zum Testen (morgen)
1. **Cockpit** (`/cockpit`, admin@flowstate.app / Flowstate2026) → Karte neu laden → Profilbilder + 🗑 sind da.
2. Einen Betrieb öffnen → **Scanner** → eine eigene Karte stempeln → **grüne Haken erscheinen** in der Wallet (live-Update).
3. Einen QR aus dem Dashboard scannen → **Konfetti-Seite** + Wallet-Hinzufügen.
4. Fremde Karte scannen → wird **abgelehnt**.

## 📌 Offen / deine Entscheidung
- **Wallet-Stapel komplett trennen?** (eigene Pass-Type-IDs pro Betrieb) — ja/nein.
- **Haken-Position für abweichende Designs:** Am saubersten wäre, Designs **ohne eingezeichnete Kreise** hochzuladen — dann setze ich die funktionierenden Stempel selbst (sitzt immer perfekt, füllt sich animiert). Sag Bescheid, dann stelle ich den Upload darauf um.
- Test-Betriebe/Duplikate kannst du jetzt selbst per 🗑 wegräumen.

Schlaf gut — morgen läuft's. 🚀

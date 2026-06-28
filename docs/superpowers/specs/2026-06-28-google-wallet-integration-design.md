# Google-Wallet-Integration — Design-Spec

> Stand 28.06.2026. Ergänzt den Apple-Wallet-Pfad um Google Wallet (Android). Apple-Pfad bleibt **unangetastet**.
> Quelle für spätere Sessions: dieser Spec + `HANDOFF-KONTEXT.md`.

## 1. Ziel

Android-Gäste sollen dieselbe Karte wie iPhone-Gäste bekommen — nur in **Google Wallet** statt Apple Wallet. Ein QR, automatische Geräte-Erkennung, ein Tipp zum Hinzufügen, **Live-Update beim Stempeln**. Volle Funktionsparität mit dem Apple-Pfad.

## 2. Ehrliche Plattform-Grenzen (mit User abgestimmt)

1. **Kein pixelgenaues Apple-Design.** Google erzwingt sein eigenes Karten-Layout. Übernommen wird: Hintergrundfarbe, Logo, Hero-Banner (Stempel-Strip), dieselben Feldzeilen (`STEMPEL 3/10`, `BELOHNUNG …`), gleicher QR. Erkennbar „dieselbe Karte", aber im Google-Rahmen.
2. **„Auto-Add" = ein Tipp, nicht null Tipps.** Vollautomatisch ohne Berührung verbietet die Browser-Security. Realer Flow: QR scannen → Seite erkennt iOS/Android → ein Knopf „Zur Wallet hinzufügen" → ein Tipp öffnet die richtige Wallet.
3. **Stempel-Anzeige auf Google ist robuster als auf Apple.** Die Stempelzahl ist ein **eigenes Textfeld** (immer scharf), unabhängig vom Bild. Das Apple-Dilemma (lesbarer Strip vs. schönes Blur) entfällt.

## 3. Kartentyp & Hero

- **GenericObject für alle 5 Mechaniken** (stampcard, coupon, multipass, balance, access). Ein einheitlicher Code-Pfad, volle Slot-Kontrolle, spiegelt die Apple-Felder.
- **Object-ID = `<issuerId>.<serial>`** — gleiche `serial` wie Apple → eine Karten-Identität.
- **Hero-Banner = vom User gelieferte Design-Vorlage** (Entscheidung 28.06.: „ich generiere jedes Mal ein Design, sieht besser aus als autonom"). Es wird **dasselbe pro-Aktion-Design wiederverwendet, das er schon für Apple hochlädt**, automatisch auf Googles **3:1 (1032×344)** gefittet — kein Doppel-Upload. Auto-Generierung nur als **Fallback**, wenn für eine Aktion kein Bild vorhanden ist.
- **Stempelzahl = eigenes Textfeld** (`textModulesData`), updatet live — bleibt lesbar, unabhängig vom (auch blurry) Hero. Live-Befüllung der Stempel **im Bild** (wie Apple `strip_<n>`) ist Phase 2; v1 zeigt den Stand über das Textfeld.

### Google-Slots, die wir füllen
| Slot | Quelle | Vorgabe |
|---|---|---|
| `hexBackgroundColor` | `theme.bg` (rgb→hex) | eine Volltonfarbe, kein Verlauf |
| `logo` | Betriebs-Logo (`logo_url`/brand-logos) | PNG 1:1, ≥ 660×660 |
| `heroImage` | **User-Design** = bestehendes Strip-Bild (`/api/card-image?campaign=`) direkt, OHNE Resize | Strip ~2.6:1; Google skaliert verzerrungs-/beschnittfrei |

> **Umsetzungs-Abweichung (28.06.):** Geplant war ein 3:1-Resize via `sharp`. `sharp` (~250 MB natives Binary) sprengt aber das Vercel-Function-Größenlimit (250 MB) → verworfen. Das Strip-Bild wird unverändert als Hero geliefert (es IST das Kundendesign, ungeschnitten). Ein echter 3:1-Render kann später in der bestehenden Asset-Pipeline (Scripts nutzen sharp eh) vorab generiert + statisch ausgeliefert werden.
| `cardTitle`/`header`/`subheader` | org-Name / Kampagnen-Titel | Text |
| `textModulesData` | `cardView().structure` Felder | Label→Wert, immer scharf |
| `barcode` | `serial` | QR_CODE |

## 4. Architektur (additiv, Apple unangetastet)

| Baustein | Rolle |
|---|---|
| `api/_google.mjs` *(neu)* | Dependency-frei wie `_apns.mjs`: **RS256-Save-JWT**, OAuth2-Service-Account-Token (cached ~50min), GenericClass/Object via REST anlegen/patchen. Ohne Google-Env → no-op. |
| `lib/googleview.mjs` *(neu)* | Baut das GenericObject aus `(camp, pass, theme)`. **Nutzt `cardView()`** aus `passview.mjs` → Apple & Google driften nie auseinander. |
| `lib/mint.mjs` *(Refactor)* | Mint-Logik (Kampagne laden, Drossel `campaignMintAllowed`, Theme, `passes`-Insert) aus `pass.mjs` herausgezogen; Apple **und** Google teilen sie. Apple-Verhalten unverändert. |
| `api/card.mjs` *(neu, Dispatch)* | **Neues QR-Ziel.** UA-Erkennung: iOS → Apple-`.pkpass`, Android → Google-Save-Link-Landing, Desktop → beide Optionen. |
| `api/redeem.mjs` *(Ergänzung)* | Beim Stempeln zusätzlich `googlePatch(serial)`. APNs bleibt. Jeder Pfad no-op, wenn die andere Wallet nicht genutzt wurde. |
| `passes.google_object_id` *(Migration, nullable)* | Gesetzt wenn Google-Objekt erzeugt → Live-Update kennt das Ziel; spart API-Call bei reinen Apple-Karten. |
| `public/dashboard.html` | QR-Link `/api/pass?…` → `/api/card?…` (2 Zeilen). Alte gedruckte Apple-QRs laufen weiter. |
| `GOOGLE-WALLET-SETUP.md` *(neu)* | Klick-für-Klick: Cloud-Projekt → Wallet-API → Service-Account-JSON → Issuer-ID → Env-Vars. |

### Optional (Bonus)
`/api/pass` selbst Android-aware machen (Android-UA → Redirect zu Google), damit **alte gedruckte QR-Codes** auf Android funktionieren. iOS-Verhalten exakt gleich. Wird im Plan als separater, abschaltbarer Schritt geführt.

## 5. Datenfluss

**Ausgabe (Android):** Gast scannt QR → `/api/card?campaign|enroll` → UA=Android → `lib/mint.mjs` (Drossel + `passes`-Insert, serial) → `lib/googleview.mjs` baut GenericObject → `_google.mjs` legt Class/Object an (REST) + setzt `google_object_id` → signierter Save-JWT → Landing mit „In Google Wallet" → Tipp → `pay.google.com/gp/v/save/<jwt>`.

**Ausgabe (iOS):** `/api/card` → UA=iOS → Redirect auf bestehenden `/api/pass`-Pfad (unverändert).

**Stempeln (live):** `redeem.mjs` updatet DB → `pushUpdate(serial)` (APNs, Apple) **und** `googlePatch(serial)` (nur wenn `google_object_id` gesetzt) → Google patcht `textModulesData` + `heroImage` → Karte aktualisiert sich automatisch.

## 6. Sicherheit (Parität, Pflicht)

- Drossel `campaignMintAllowed` greift auf dem Google-Pfad (über `lib/mint.mjs`).
- Save-JWT wird **serverseitig** RS256-signiert; SA-Key nur als Base64-Env (wie Apple-Certs), nie im Client.
- Object-ID nutzt die unrätselbare `serial`.
- Ohne Google-Env bleibt alles inaktiv (kein Crash); Apple läuft unverändert.
- Keine User-Daten via innerHTML in der Landing; CORS/Headers konsistent.

## 7. Env-Vars (User liefert später)

```
GOOGLE_WALLET_ISSUER_ID=          # aus Google Pay & Wallet Console (Freigabe kann Tage dauern)
GOOGLE_WALLET_SA_JSON_B64=        # KOMPLETTE Service-Account-JSON-Datei, base64 (enthält client_email + private_key)
```
> Nutzerfreundlicher als drei Felder: User lädt EINE JSON-Datei, base64-kodiert sie, fügt sie ein. `client_email` + `private_key` werden serverseitig daraus gelesen.

## 8. Non-Goals / später

- Live-Befüllung der Stempel **im Hero-Bild** (wie Apple `strip_<n>`) — Phase 2; v1 nutzt das Textfeld.
- Push-Benachrichtigungen via Google „messages" (optional, Phase 2).
- Native Loyalty/Offer-Klassen (bewusst GenericObject gewählt).

## 9. Akzeptanzkriterien

1. iPhone-Scan: unverändert Apple-Pass (kein Regress).
2. Android-Scan: ein Tipp → Karte in Google Wallet, korrekte Farbe/Logo/Felder/QR.
3. Stempeln: Android-Karte aktualisiert sich automatisch (`3/10 → 4/10`).
4. Ohne Google-Env: keine Fehler, Apple-Pfad voll funktionsfähig.
5. Drossel greift auf dem Google-Mint-Pfad.
6. `GOOGLE-WALLET-SETUP.md` führt vom leeren Google-Konto bis zu gesetzten Env-Vars.

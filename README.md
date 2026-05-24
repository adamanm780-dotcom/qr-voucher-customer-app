# QR Voucher System - Customer App

## Übersicht
White-Label-Gutschein-App für Customers. Customers scannen QR-Codes und speichern Gutscheine in Apple Wallet.

## Struktur
```
public/
  ├── index.html       # Single-Page App (Scanner + Confirmation)
  └── app.js           # QR-Scanning Logic + API Integration
```

## Features

### 1. QR Scanner
- Browser-Kamera-Zugriff (Web API)
- jsQR Library für QR-Erkennung
- Mobile-optimiert (iPhone + Android)
- Visuelle Scan-Zone mit Overlay

### 2. Bestätigungsseite
- Lädt Gutschein-Daten vom Backend
- Zeigt Business-Name + Angebot
- Download der `.pkpass`-Datei für Apple Wallet

### 3. Fehlerbehandlung
- Kamerazugriff-Fehler
- Ungültige QR-Codes
- API-Fehler

## API-Integration

### Endpoint: `/api/pass?code=xxx`

**Request:**
```
GET /api/pass?code=ABC123
```

**Response (JSON):**
```json
{
  "success": true,
  "passUrl": "https://example.com/passes/ABC123.pkpass",
  "voucher": {
    "code": "ABC123",
    "businessName": "Lila Wiesbaden",
    "offer": "20% Rabatt auf Getränke"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Ungültiger Gutschein-Code"
}
```

## Mobile-First Design
- Responsive bis 320px Breite
- Touch-optimierte Buttons
- Vollscreen-Video auf mobilen Geräten
- Safe Area-Padding

## Browser-Unterstützung
- Chrome/Edge (Android)
- Safari (iOS 14.5+)
- Firefox

## Deployment
```bash
# Dateien in public/ hochladen
# Beispiel: Netlify Drop, Vercel, oder statischer Server
```

## QR-Code Format
Der QR-Code kann folgende Daten enthalten:
```
https://example.com/?code=ABC123
```
oder direkt:
```
ABC123
```

Die App extrahiert automatisch den Code-Parameter.

## Testing

### Lokal mit jsDelivr CDN
```bash
# npm install
# npx http-server public/
```

### Manuelles Testen
1. Scanner-Button klicken
2. Kamera-Zugriff erlauben
3. QR-Code vor Kamera halten
4. Automatisch zur Bestätigung wechseln
5. "In Apple Wallet speichern" → `.pkpass` heruntergeladen

## Integrationen mit Employee-Session

1. **QR-Code Generation** (Employee-Seite)
   - Generiert Codes der Form: `code=ABC123`
   - QR-Code ist URL oder direkter Code

2. **API-Backend** (Shared)
   - `/api/pass?code=xxx` muss signierte `.pkpass` zurückgeben
   - Validiert Codes + gibt Voucher-Daten zurück

3. **Pass Kit Integration**
   - `.pkpass` Dateien werden vom Backend signiert
   - Customer-App downloaded sie automatisch

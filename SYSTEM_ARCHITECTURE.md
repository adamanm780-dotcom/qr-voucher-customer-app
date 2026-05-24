# QR Voucher System - Gesamtarchitektur

**Status:** In Entwicklung (Customer-App: ✅ | Employee-Seite: 🔄 | Backend/API: 🔄)

---

## 1. Multi-Tenant-Architektur (Datenbank-Schema)

### Datenmodell

```
┌─────────────┐
│  BUSINESSES │ (Mandanten)
├─────────────┤
│ id          │ UUID
│ name        │ string (z.B. "Lila Wiesbaden")
│ slug        │ string (eindeutig pro Mandant)
│ logo_url    │ string (optional)
│ branding    │ JSON (Farben, Fonts, etc.)
│ created_at  │ timestamp
│ updated_at  │ timestamp
│ is_active   │ boolean
└─────────────┘
        │
        ├──→ VOUCHERS (viele zu eins)
        ├──→ EMPLOYEES (viele zu eins)
        └──→ API_KEYS (viele zu eins)
```

```
┌──────────────┐
│   VOUCHERS   │ (Gutscheine)
├──────────────┤
│ id           │ UUID
│ business_id  │ UUID (FK → BUSINESSES)
│ code         │ string (eindeutig global)
│ offer        │ string (z.B. "20% Rabatt")
│ description  │ text (optional)
│ value        │ decimal (optional, für Euro-Gutscheine)
│ valid_from   │ date
│ valid_until  │ date
│ max_uses     │ int (0 = unlimited)
│ used_count   │ int (default: 0)
│ redeemed_by  │ UUID[] (Array von Customer IDs, falls Tracking)
│ status       │ enum: "active" | "archived" | "expired"
│ created_at   │ timestamp
│ updated_at   │ timestamp
└──────────────┘
```

```
┌───────────────┐
│   EMPLOYEES   │ (Mitarbeiter für QR-Generierung)
├───────────────┤
│ id            │ UUID
│ business_id   │ UUID (FK → BUSINESSES)
│ email         │ string (eindeutig pro Business)
│ password_hash │ string
│ name          │ string
│ role          │ enum: "admin" | "cashier"
│ is_active     │ boolean
│ last_login    │ timestamp
│ created_at    │ timestamp
└───────────────┘
```

```
┌──────────────┐
│   PASSES     │ (Apple Wallet Pässe)
├──────────────┤
│ id           │ UUID
│ voucher_id   │ UUID (FK → VOUCHERS)
│ pass_data    │ JSON (signierte Pass-Metadaten)
│ pkpass_url   │ string (S3 oder ähnlich)
│ created_at   │ timestamp
└──────────────┘
```

```
┌──────────────────┐
│    API_KEYS      │ (für Employee-Backend)
├──────────────────┤
│ id               │ UUID
│ business_id      │ UUID (FK → BUSINESSES)
│ key              │ string (secret, gehashed)
│ last_used        │ timestamp
│ created_at       │ timestamp
└──────────────────┘
```

### SQL-Beispiele (PostgreSQL)

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    branding JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    offer VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(10, 2),
    valid_from DATE,
    valid_until DATE,
    max_uses INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(business_id, email)
);

CREATE TABLE passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    pass_data JSONB,
    pkpass_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vouchers_business ON vouchers(business_id);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_employees_business ON employees(business_id);
```

---

## 2. Deployment-Plan

### Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────┐
│ INTERNET                                                 │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    [iOS/Android]    [Employee Web]
        │                 │
        │                 │
  ┌─────▼─────┐    ┌─────▼──────────────┐
  │            │    │                    │
  │  CUSTOMER  │    │  EMPLOYEE         │
  │  APP CDN   │    │  DASHBOARD        │
  │ (Netlify)  │    │ (Vercel/Docker)   │
  │            │    │                    │
  └─────┬──────┘    └─────┬──────────────┘
        │                 │
        │    ┌────────────┘
        │    │
        └────▼─────────────────────┐
             │                      │
        ┌────▼──────────┐    ┌──────▼──────────┐
        │                │    │                 │
        │  REST API      │    │  DATABASE       │
        │  (Node/Python) │    │  (PostgreSQL)   │
        │  :5000         │    │  Port 5432      │
        │                │    │                 │
        └────┬───────────┘    └─────────────────┘
             │
             │
        ┌────▼─────────────────┐
        │ Pass Kit Signing     │
        │ Service              │
        │ (Apple PKPass Gen)   │
        └─────────────────────┘
```

### Deployment-Phasen

#### Phase 1: Development (Lokal)
```bash
# Customer-App
cd qr-voucher-customer-app
node server.js  # Mock API auf :3000

# Employee-Backend (parallel)
# npm install && npm start  # auf :5000
```

#### Phase 2: Staging
**Customer-App:** Netlify Drop (öffentlich testbar)
**Employee-Dashboard:** Vercel oder Docker
**API:** Railway/Render (Free-Tier) oder selbst gehostet

#### Phase 3: Production
**Customer-App:**
- CDN: Cloudflare/Netlify (global)
- Domain: `voucher.client.com`

**Employee-Dashboard:**
- Docker auf AWS/GCP/DigitalOcean
- Domain: `admin.client.com`
- HTTPS + Rate-Limiting

**API-Backend:**
- Node.js/Python auf AWS Lambda, Google Cloud Run, oder selbst gehostet
- Database: PostgreSQL (managed: AWS RDS, Google Cloud SQL)
- Pass Kit Signing: lokal oder via Fastlane

#### Phase 4: Multi-Tenant-Deployment
Jeder Business kann optional:
1. **White-Label-Domain:** `voucher.lilawiebaden.de` (CNAME)
2. **Eigenes Branding:** Logo + Farben via `/api/config`
3. **Private API-Key:** Für Integration in eigenes System

---

## 3. Admin-Dashboard-Features (Employee-Seite)

### Übersicht
Employees (Kassenpersonal, Manager) der Businesses erstellen, verwalten und scannen Gutscheine.

### Login-Seite
```
[Business Email] → Eindeutige Sub-Domain pro Business
[Password]
[Login]
```

### Dashboard Hauptseite
```
┌──────────────────────────────────────────────┐
│ Lila Wiesbaden | Logout | Profil             │
├──────────────────────────────────────────────┤
│                                              │
│ 📊 ÜBERBLICK                                 │
│ ├─ Aktive Gutscheine: 45                    │
│ ├─ Heute eingelöst: 8                       │
│ ├─ Verfügbar heute: 37                      │
│ └─ Ablauf nächste Woche: 5                  │
│                                              │
│ ➕ NEUER GUTSCHEIN                          │
│ ├─ Titel: [20% Rabatt]                     │
│ ├─ Beschreibung: [Auf alle Getränke]       │
│ ├─ Gültig bis: [DD.MM.YYYY]                │
│ ├─ Max. Nutzungen: [0 = unbegrenzt]        │
│ └─ [ERSTELLEN] → QR-Code generiert         │
│                                              │
│ 📋 GUTSCHEIN-LISTE                          │
│ ├─ ABC123 | 20% Rabatt | 5/10 | Aktiv      │
│ ├─ XYZ789 | Kostenlos | 0/∞  | Aktiv       │
│ └─ [Mehr...]                                │
│                                              │
└──────────────────────────────────────────────┘
```

### Features pro Role

#### Admin
- ✅ Gutscheine erstellen/löschen
- ✅ Employees verwalten
- ✅ Branding-Einstellungen
- ✅ Reports + Analytics
- ✅ API-Keys generieren

#### Cashier (Kassenpersonal)
- ✅ Gutscheine ausstellen (QR generieren)
- ✅ QR-Codes drucken
- ✅ Gutscheine scannen (iOS-App)
- ❌ Gutscheine löschen
- ❌ Employees verwalten

### UI-Komponenten

#### 1. Gutschein-Erstellen (Modal)
```
[Titel] [Beschreibung]
[Gültig von] [bis]
[Wert in €] [Max. Nutzungen]
[ERSTELLEN] [ABBRECHEN]

→ Zeigt QR-Code zum Drucken/Download
```

#### 2. QR-Code Drucken
```
Logo + QR-Code + Angebot auf A4 drucken
```

#### 3. Gutschein-Liste (Tabelle)
```
Code | Angebot | Nutzungen | Gültig bis | Status | Aktionen
ABC123 | 20% | 5/10 | 31.12.2024 | Aktiv | Edit | Delete | Print QR
```

#### 4. Analytics
```
- Gutscheine heute eingelöst
- Top-Angebote (nach Häufigkeit)
- Zeitreihe (tägliche Einlösungen)
- Export zu CSV
```

### API-Endpoints (für Employee-Backend)

```
POST   /api/auth/login           → Login + JWT
POST   /api/auth/logout          → Logout
GET    /api/business             → Business-Profil
PATCH  /api/business             → Business-Einstellungen

POST   /api/vouchers             → Gutschein erstellen
GET    /api/vouchers             → Liste (gefiltert)
GET    /api/vouchers/:id         → Einzeln
PATCH  /api/vouchers/:id         → Bearbeiten
DELETE /api/vouchers/:id         → Löschen

GET    /api/vouchers/:id/qr      → QR-Code generieren
GET    /api/vouchers/:id/print   → Print-friendly HTML

GET    /api/analytics            → Dashboard-Daten
GET    /api/analytics/export     → CSV-Export

GET    /api/employees            → (Admin only)
POST   /api/employees            → (Admin only)
DELETE /api/employees/:id        → (Admin only)

GET    /api/pass?code=ABC123     → (Public) Pass-Daten für Customer-App
```

---

## 4. Sicherheit & Rate-Limiting

### API-Sicherheit
- JWT-Token (HS256, 24h Expiry)
- CORS (nur vertrauenswürdige Domains)
- Rate-Limit: 100 req/min pro IP
- Input-Validierung (Code-Format, Datum-Bereich)
- HTTPS nur

### Pass Kit Security
- `.pkpass` wird signiert mit Apple-Zertifikat
- Signatur verhindert Manipulation
- Pass-IDs sind einmalig

### Database
- Passwords gehasht (bcrypt, nicht plain-text!)
- API-Keys gehasht
- Sensitive Felder encrypted (z.B. Kundendaten)

---

## 5. Nächste Schritte

### Customer-App (Diese Session) ✅
- [x] QR-Scanner
- [x] Wallet-Integration
- [x] Mobile-Design
- [ ] **Testing auf echten Devices** (iPhone + Android)

### Employee-Backend (Andere Session) 🔄
- [ ] Login/Auth
- [ ] Gutschein-CRUD
- [ ] QR-Generator
- [ ] Admin-Dashboard
- [ ] Analytics

### Shared Infrastructure 🔄
- [ ] API-Backend (/api/pass, /api/vouchers, etc.)
- [ ] Database-Setup (PostgreSQL)
- [ ] Pass Kit Integration (Signierung)
- [ ] Deployment-Scripts

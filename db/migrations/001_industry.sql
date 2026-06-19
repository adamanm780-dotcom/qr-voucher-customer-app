-- Phase 1 — Fundament: Branche/Nische pro Betrieb.
-- Einmalig im Supabase SQL-Editor ausführen (Projekt "voucher flow").
-- Bestehende 41 Betriebe sind alle Gastronomie -> Default backfüllt sie automatisch.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'gastronomie';

-- Schneller Filter im Cockpit (Liste pro Nische).
CREATE INDEX IF NOT EXISTS businesses_industry_idx ON businesses (industry);

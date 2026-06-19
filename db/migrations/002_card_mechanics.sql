-- Phase 2 — Kartentyp-Baukasten: Fundament für neue Mechaniken (multipass/balance/access).
-- Einmalig im Supabase SQL-Editor ausführen (Projekt "voucher flow").
-- Rein additiv + Constraints permissiver -> ändert KEIN bestehendes Verhalten (Gastro bleibt heil).

-- 1) Typ-spezifische Konfiguration pro Aktion (max. Einlösungen, Startguthaben, Gültigkeit …)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Pro ausgegebener Karte: Restzähler (Mehrfachkarte: Einlösungen übrig; Guthaben: Betrag übrig)
ALTER TABLE passes ADD COLUMN IF NOT EXISTS remaining numeric;

-- 3) campaigns.type: neue Mechaniken zulassen (alten CHECK robust per Name finden + ersetzen)
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid='campaigns'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP EXECUTE 'ALTER TABLE campaigns DROP CONSTRAINT '||quote_ident(c); END LOOP; END $$;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check
  CHECK (type IN ('stampcard','coupon','multipass','balance','access'));

-- 4) redemptions.action: neue Aktionen (use=Mehrfach-Einlösung, debit=Guthaben-Abzug, entry=Zutritt)
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid='redemptions'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%action%'
  LOOP EXECUTE 'ALTER TABLE redemptions DROP CONSTRAINT '||quote_ident(c); END LOOP; END $$;
ALTER TABLE redemptions ADD CONSTRAINT redemptions_action_check
  CHECK (action IN ('enroll','stamp','redeem','use','debit','entry'));

-- 5) passes.status: neue Zustände (depleted=aufgebraucht, expired=abgelaufen)
DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid='passes'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP EXECUTE 'ALTER TABLE passes DROP CONSTRAINT '||quote_ident(c); END LOOP; END $$;
ALTER TABLE passes ADD CONSTRAINT passes_status_check
  CHECK (status IN ('active','redeemed','completed','depleted','expired'));

-- Personalisierung: eigene "Erstellen"-Vorlagen pro Betrieb.
-- Einmalig im Supabase SQL-Editor ausführen. Leeres Array = Fallback auf Branchen-Defaults.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS templates jsonb NOT NULL DEFAULT '[]'::jsonb;

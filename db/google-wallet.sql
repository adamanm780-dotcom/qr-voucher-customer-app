-- Google-Wallet-Integration: Verknüpft eine ausgegebene Karte (serial) mit ihrem
-- Google-Wallet-GenericObject, damit Live-Updates das richtige Objekt patchen.
-- Additiv + idempotent. Apple-Pfad unberührt.
alter table public.passes
  add column if not exists google_object_id text;

comment on column public.passes.google_object_id is
  'Google Wallet GenericObject-ID (<issuerId>.<serial>); null = keine Google-Karte ausgegeben.';

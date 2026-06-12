-- Erweiterung für Apple Wallet Live-Updates (PassKit Web Service Protocol)
-- Stand: 02.06.2026

-- Geräte-Registrierungen: wenn ein Pass in einer Wallet liegt, registriert das Gerät
-- sich für Updates. Wir brauchen pushToken pro (Gerät, Pass).
create table if not exists device_registrations (
  id                uuid primary key default gen_random_uuid(),
  device_library_id text not null,          -- von Apple: deviceLibraryIdentifier
  pass_serial       text not null,          -- unsere serial (= passes.serial)
  push_token        text not null,          -- APNs Push-Token des Geräts
  created_at        timestamptz default now(),
  unique (device_library_id, pass_serial)
);
create index if not exists idx_devreg_serial on device_registrations(pass_serial);
create index if not exists idx_devreg_device on device_registrations(device_library_id);

-- passes braucht ein updated_at für "if-modified-since" (hat es schon) +
-- wir nutzen die vorhandene auth_token-Spalte als authenticationToken.

-- RLS: device_registrations wird nur vom Server (service_role) beschrieben -> RLS an, keine public policy.
alter table device_registrations enable row level security;

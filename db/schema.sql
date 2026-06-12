-- FlowState Wallet — Datenmodell (Multi-Tenant)
-- Supabase-Projekt: voucher flow (https://uyqjaasrnqkvuhgtnjbj.supabase.co), Region eu-west-2 London
-- Stand: 31.05.2026

-- 1. Betriebe (eure Kunden)
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete set null,
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  color_bg    text default '#4c2882',
  color_text  text default '#ffffff',
  created_at  timestamptz default now()
);

-- 2. Kampagnen (Vorlagen: Gutschein ODER Stempelkarte)
create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  type          text not null check (type in ('coupon','stampcard')),
  title         text not null,
  description   text,
  value         text,                 -- z.B. "20%"
  stamp_goal    int,                  -- nur Stempelkarte, z.B. 10
  reward        text,                 -- Belohnung bei voller Karte
  enroll_token  text unique,          -- Dauer-QR Token (Tresen)
  active        boolean default true,
  created_at    timestamptz default now()
);

-- 3. Ausgegebene Karten der Mitglieder
create table passes (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  serial        text unique not null,
  auth_token    text not null,
  stamps        int default 0,
  status        text default 'active' check (status in ('active','redeemed','completed')),
  member_label  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 4. Verlauf (jeder +1 Stempel & jede Einlösung)
create table redemptions (
  id            uuid primary key default gen_random_uuid(),
  pass_id       uuid not null references passes(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  action        text not null check (action in ('enroll','stamp','redeem')),
  note          text,
  created_at    timestamptz default now()
);

-- Sicherheit: Row Level Security an (Zugriff später nur auf eigene Daten)
alter table businesses  enable row level security;
alter table campaigns   enable row level security;
alter table passes      enable row level security;
alter table redemptions enable row level security;

-- Tempo: Indizes für schnelle Abfragen
create index on campaigns(business_id);
create index on passes(campaign_id);
create index on passes(business_id);
create index on redemptions(pass_id);

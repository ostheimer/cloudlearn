-- clearn initial schema
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  subscription_expires_at timestamptz,
  monthly_scan_count int not null default 0,
  scan_count_reset_at timestamptz,
  preferred_language text not null default 'de',
  locale text not null default 'de-DE',
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  card_count int not null default 0,
  is_public boolean not null default false,
  cover_image_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  front text not null,
  back text not null,
  card_type text not null default 'basic',
  extra_data jsonb,
  source_image_url text,
  source_text text,
  source_scan_id uuid,
  ai_model text,
  fsrs_stability double precision not null default 0,
  fsrs_difficulty double precision not null default 0,
  fsrs_due timestamptz not null default now(),
  fsrs_last_review timestamptz,
  fsrs_reps int not null default 0,
  fsrs_lapses int not null default 0,
  fsrs_state text not null default 'new',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  idempotency_key text not null,
  rating int not null,
  review_duration_ms int,
  reviewed_at timestamptz not null default now()
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  extracted_text text,
  ai_response jsonb,
  ai_model text,
  status text not null default 'processed',
  error_code text,
  cards_generated int not null default 0,
  processing_time_ms int,
  created_at timestamptz not null default now()
);

create unique index if not exists review_logs_idempotency_key_idx
  on review_logs (user_id, idempotency_key);

create index if not exists cards_due_idx
  on cards (user_id, fsrs_due) where deleted_at is null;

create index if not exists scans_created_idx
  on scans (user_id, created_at desc);

alter table profiles enable row level security;
alter table decks enable row level security;
alter table cards enable row level security;
alter table review_logs enable row level security;
alter table scans enable row level security;

create policy "users_own_profile" on profiles
  for all using (auth.uid() = id);

create policy "users_own_decks" on decks
  for all using (auth.uid() = user_id);

create policy "users_own_cards" on cards
  for all using (auth.uid() = user_id);

create policy "users_own_review_logs" on review_logs
  for all using (auth.uid() = user_id);

create policy "users_own_scans" on scans
  for all using (auth.uid() = user_id);

create policy "public_decks_visible" on decks
  for select using (is_public = true);

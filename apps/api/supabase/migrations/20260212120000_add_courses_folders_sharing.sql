-- Add courses, folders, and sharing support for deck action menu

-- ─── Courses ─────────────────────────────────────────────────────────────────

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists course_decks (
  course_id uuid not null references courses(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (course_id, deck_id)
);

-- ─── Folders ─────────────────────────────────────────────────────────────────

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  parent_id uuid references folders(id) on delete cascade,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists folder_decks (
  folder_id uuid not null references folders(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (folder_id, deck_id)
);

-- ─── Deck extensions for sharing and duplication ─────────────────────────────

alter table decks add column if not exists share_token uuid;
alter table decks add column if not exists source_deck_id uuid references decks(id) on delete set null;

create unique index if not exists decks_share_token_idx on decks (share_token) where share_token is not null;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists courses_user_idx on courses (user_id);
create index if not exists folders_user_idx on folders (user_id);
create index if not exists folders_parent_idx on folders (parent_id);
create index if not exists course_decks_deck_idx on course_decks (deck_id);
create index if not exists folder_decks_deck_idx on folder_decks (deck_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table courses enable row level security;
alter table course_decks enable row level security;
alter table folders enable row level security;
alter table folder_decks enable row level security;

create policy "users_own_courses" on courses
  for all using (auth.uid() = user_id);

create policy "users_own_course_decks" on course_decks
  for all using (
    exists (select 1 from courses where courses.id = course_decks.course_id and courses.user_id = auth.uid())
  );

create policy "users_own_folders" on folders
  for all using (auth.uid() = user_id);

create policy "users_own_folder_decks" on folder_decks
  for all using (
    exists (select 1 from folders where folders.id = folder_decks.folder_id and folders.user_id = auth.uid())
  );

-- Allow reading shared decks by share token (public access)
create policy "shared_decks_visible" on decks
  for select using (share_token is not null);

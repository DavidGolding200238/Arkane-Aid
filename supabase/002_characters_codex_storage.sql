-- Arkane Aid backend phase 2
-- Paste into the Supabase SQL editor and run once, after 001.
-- Safe to re-run. Does not drop the existing tables.
--
-- Covers:
--   Ledger  = player sheet (name, class, race, background, stats, portrait, equipment)
--   Codex   = party notes / items / events, split by kind for the tabs
--   Scribe  = same tables, source = 'scribe' so AI writes show up in the tabs
--   Tome    = still uses profiles (display name). Account photo is separate.

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  party_id uuid references public.parties (id) on delete set null,
  name text not null default '',
  class text,
  race text,
  background text,
  str int not null default 10 check (str between 1 and 30),
  dex int not null default 10 check (dex between 1 and 30),
  con int not null default 10 check (con between 1 and 30),
  int int not null default 10 check (int between 1 and 30),
  wis int not null default 10 check (wis between 1 and 30),
  cha int not null default 10 check (cha between 1 and 30),
  portrait_url text,
  traits text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters add column if not exists traits text;

create unique index if not exists characters_user_party_unique
  on public.characters (user_id, party_id)
  where party_id is not null;

create table if not exists public.character_equipment (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity int not null default 1 check (quantity > 0),
  notes text,
  source text not null default 'user' check (source in ('user', 'scribe')),
  created_at timestamptz not null default now()
);

create table if not exists public.codex_entries (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('note', 'item', 'event')),
  title text,
  body text not null check (char_length(body) between 1 and 4000),
  source text not null default 'user' check (source in ('user', 'scribe')),
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;
alter table public.character_equipment enable row level security;
alter table public.codex_entries enable row level security;

-- One character per signed-in user for a party. Owner edits. Party can read.
drop policy if exists "owner write character" on public.characters;
create policy "owner write character"
  on public.characters for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "party read characters" on public.characters;
create policy "party read characters"
  on public.characters for select
  to authenticated
  using (
    user_id = auth.uid()
    or (party_id is not null and public.is_party_member(party_id))
  );

-- Equipment follows the character. Owner adds (including Scribe writes as the user).
drop policy if exists "owner write equipment" on public.character_equipment;
create policy "owner write equipment"
  on public.character_equipment for all
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "party read equipment" on public.character_equipment;
create policy "party read equipment"
  on public.character_equipment for select
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_id
        and (
          c.user_id = auth.uid()
          or (c.party_id is not null and public.is_party_member(c.party_id))
        )
    )
  );

-- Codex: party members read. Author writes. Scribe writes use the user's id.
drop policy if exists "members read codex" on public.codex_entries;
create policy "members read codex"
  on public.codex_entries for select
  to authenticated
  using (public.is_party_member(party_id));

drop policy if exists "members write codex" on public.codex_entries;
create policy "members write codex"
  on public.codex_entries for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_party_member(party_id)
  );

drop policy if exists "author update own codex" on public.codex_entries;
create policy "author update own codex"
  on public.codex_entries for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "author delete own codex" on public.codex_entries;
create policy "author delete own codex"
  on public.codex_entries for delete
  to authenticated
  using (author_id = auth.uid());

grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.character_equipment to authenticated;
grant select, insert, update, delete on public.codex_entries to authenticated;

-- Portrait bucket. File path must start with the user's id, so a player
-- can only write their own photo. Public read so the sheet can show the URL.
insert into storage.buckets (id, name, public)
values ('character-portraits', 'character-portraits', true)
on conflict (id) do nothing;

drop policy if exists "portrait public read" on storage.objects;
create policy "portrait public read"
  on storage.objects for select
  to public
  using (bucket_id = 'character-portraits');

drop policy if exists "portrait owner write" on storage.objects;
create policy "portrait owner write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'character-portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "portrait owner update" on storage.objects;
create policy "portrait owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'character-portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'character-portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "portrait owner delete" on storage.objects;
create policy "portrait owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'character-portraits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

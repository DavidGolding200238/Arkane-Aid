-- Arkane Aid backend phase 3
-- Applied by `supabase db push` (or paste into the SQL editor, after 002).
-- Safe to re-run. Does not drop existing tables.
--
-- Adds:
--   level, hp_current, hp_max on the character sheet
--   character_traits as a list, same pattern as equipment

alter table public.characters add column if not exists level int not null default 1;
alter table public.characters add column if not exists hp_current int not null default 10;
alter table public.characters add column if not exists hp_max int not null default 10;

alter table public.characters drop constraint if exists characters_level_check;
alter table public.characters add constraint characters_level_check check (level between 1 and 20);

alter table public.characters drop constraint if exists characters_hp_current_check;
alter table public.characters add constraint characters_hp_current_check check (hp_current between 0 and 999);

alter table public.characters drop constraint if exists characters_hp_max_check;
alter table public.characters add constraint characters_hp_max_check check (hp_max between 1 and 999);

create table if not exists public.character_traits (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  source text not null default 'user' check (source in ('user', 'scribe')),
  created_at timestamptz not null default now()
);

alter table public.character_traits enable row level security;

drop policy if exists "owner write traits" on public.character_traits;
create policy "owner write traits"
  on public.character_traits for all
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

drop policy if exists "party read traits" on public.character_traits;
create policy "party read traits"
  on public.character_traits for select
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

grant select, insert, update, delete on public.character_traits to authenticated;

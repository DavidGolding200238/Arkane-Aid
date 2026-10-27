-- Arkane Aid backend phase 7: subclass, lineage and homebrew species traits on the Character
-- Sheet, and the Codex's Weapons and Spells. Applied by `npx supabase db push`. Safe to re-run.
--
-- 1. characters.subclass and characters.lineage (Elven Lineage, Draconic Ancestry, ...) as text.
-- 2. characters.race_traits: the traits a player writes for a custom (homebrew) species,
--    {"bonuses": text, "size": text, "speed": int or null, "abilities": text}.
-- 3. character_weapons and character_spells: one list per character, so per user per party,
--    with the same Row Level Security as character_equipment (the owner writes, the party reads).
--    At most one weapon per character is marked in hand.

alter table public.characters add column if not exists subclass text;
alter table public.characters add column if not exists lineage text;
alter table public.characters add column if not exists race_traits jsonb;

create table if not exists public.character_weapons (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  damage text not null default '' check (char_length(damage) <= 40),
  damage_type text not null default '' check (char_length(damage_type) <= 40),
  to_hit int check (to_hit between -10 and 30),
  properties text not null default '' check (char_length(properties) <= 200),
  description text not null default '' check (char_length(description) <= 1000),
  in_hand boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists character_weapons_one_in_hand
  on public.character_weapons (character_id)
  where in_hand;
create index if not exists character_weapons_character_idx on public.character_weapons (character_id);

create table if not exists public.character_spells (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  level int not null default 0 check (level between 0 and 9),
  school text not null default '' check (char_length(school) <= 40),
  casting_time text not null default '' check (char_length(casting_time) <= 160),
  range text not null default '' check (char_length(range) <= 80),
  verbal boolean not null default false,
  somatic boolean not null default false,
  material boolean not null default false,
  material_text text not null default '' check (char_length(material_text) <= 200),
  duration text not null default '' check (char_length(duration) <= 80),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists character_spells_character_idx on public.character_spells (character_id, level);

alter table public.character_weapons enable row level security;
alter table public.character_spells enable row level security;

drop policy if exists "owner write weapons" on public.character_weapons;
create policy "owner write weapons"
  on public.character_weapons for all
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

drop policy if exists "party read weapons" on public.character_weapons;
create policy "party read weapons"
  on public.character_weapons for select
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

drop policy if exists "owner write spells" on public.character_spells;
create policy "owner write spells"
  on public.character_spells for all
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

drop policy if exists "party read spells" on public.character_spells;
create policy "party read spells"
  on public.character_spells for select
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

grant select, insert, update, delete on public.character_weapons to authenticated;
grant select, insert, update, delete on public.character_spells to authenticated;

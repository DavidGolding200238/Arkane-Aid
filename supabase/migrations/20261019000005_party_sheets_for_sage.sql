-- Arkane Aid backend phase 5: party context for the Sage, and tighter writes.
-- Applied by `supabase db push`. Safe to re-run.
--
-- 1. A character can only be put in a party its owner belongs to. Before this, the owner
--    could set any party_id and their sheet would show up in a stranger's party.
-- 2. Codex edits cannot move an entry into a party the author is not in.
-- 3. party_sheets(party): the sheets of everyone in a party, for the Sage's "what can the
--    party do" questions. It runs as the caller (security invoker), so the normal Row Level
--    Security policies decide what comes back, and it returns nothing unless the caller is a
--    member. The sage edge function calls it with the player's own token, never a secret key.

drop policy if exists "owner write character" on public.characters;
create policy "owner write character"
  on public.characters for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (party_id is null or public.is_party_member(party_id))
  );

drop policy if exists "author update own codex" on public.codex_entries;
create policy "author update own codex"
  on public.codex_entries for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.is_party_member(party_id)
  );

create index if not exists characters_party_idx on public.characters (party_id);
create index if not exists character_equipment_character_idx on public.character_equipment (character_id);
create index if not exists character_traits_character_idx on public.character_traits (character_id);
create index if not exists codex_entries_party_idx on public.codex_entries (party_id, created_at desc);

create or replace function public.party_sheets(target uuid)
returns table (
  name text,
  class text,
  race text,
  level int,
  hp_current int,
  hp_max int,
  ac int,
  speed int,
  str int,
  dex int,
  con int,
  "int" int,
  wis int,
  cha int,
  skills text[],
  features text,
  traits text[],
  gear text[],
  is_me boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.name,
    c.class,
    c.race,
    c.level,
    c.hp_current,
    c.hp_max,
    c.ac,
    c.speed,
    c.str,
    c.dex,
    c.con,
    c.int,
    c.wis,
    c.cha,
    c.skills,
    left(c.features, 600),
    coalesce((select array_agg(t.name order by t.created_at) from public.character_traits t where t.character_id = c.id), '{}'),
    coalesce((select array_agg(e.name || case when e.quantity > 1 then ' x' || e.quantity else '' end order by e.created_at)
              from public.character_equipment e where e.character_id = c.id), '{}'),
    c.user_id = auth.uid()
  from public.characters c
  where c.party_id = target
    and public.is_party_member(target)
  order by c.name
  limit 12;
$$;

revoke all on function public.party_sheets(uuid) from public, anon;
grant execute on function public.party_sheets(uuid) to authenticated;

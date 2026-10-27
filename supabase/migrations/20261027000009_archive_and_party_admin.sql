-- Arkane Aid: the Archive, leaving a party, handing over DM and deleting a party.
-- Applied by `npx supabase db push`. Safe to re-run.
--
-- 1. characters.archived_at and characters.archived_party_name: a sheet whose party was left or
--    deleted is kept, retired, with party_id null and the party's name stamped on it. Sheets
--    with party_id null and no archive stamp (the no-party sheet) behave as before.
-- 2. leave_party(target): a player leaves; their sheet in the party is archived. The DM can't
--    leave (hand over DM or delete the party first). Codex notes they wrote stay with the party.
-- 3. transfer_dm(target, new_dm): the DM hands the party to another member.
-- 4. delete_party(target): the DM deletes the party. Every sheet in it is archived first;
--    the party's chat (ledger_entries) and Codex go with it (on delete cascade).
-- 5. copy_from_archive(sheet, target): copies a retired sheet, with its weapons, spells,
--    equipment and traits, into a party the caller belongs to and has no sheet in yet.
-- 6. delete_archived(sheet): deletes one of the caller's retired sheets for good.
-- 7. party_sheets(target) skips archived sheets (they have no party, so this is belt and braces).

alter table public.characters add column if not exists archived_at timestamptz;
alter table public.characters add column if not exists archived_party_name text;

create or replace function public.leave_party(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.parties;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into found from public.parties where id = target;
  if found.id is null or not public.is_party_member(target) then
    raise exception 'You are not in that party.';
  end if;
  if found.created_by = auth.uid() then
    raise exception 'The DM can''t leave. Hand over DM to another member, or delete the party.';
  end if;

  update public.characters
     set archived_at = now(), archived_party_name = found.name, party_id = null
   where party_id = target and user_id = auth.uid();

  delete from public.party_members where party_id = target and user_id = auth.uid();
end;
$$;

create or replace function public.transfer_dm(target uuid, new_dm uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.parties where id = target and created_by = auth.uid()) then
    raise exception 'Only the DM can hand over the party.';
  end if;
  if new_dm = auth.uid() then
    raise exception 'You are already the DM.';
  end if;
  if not exists (select 1 from public.party_members where party_id = target and user_id = new_dm) then
    raise exception 'The new DM must be a member of the party.';
  end if;

  update public.parties set created_by = new_dm where id = target;
  update public.party_members set role = 'player' where party_id = target and user_id = auth.uid();
  update public.party_members set role = 'dm' where party_id = target and user_id = new_dm;
end;
$$;

create or replace function public.delete_party(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.parties;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into found from public.parties where id = target;
  if found.id is null or found.created_by <> auth.uid() then
    raise exception 'Only the DM can delete the party.';
  end if;

  update public.characters
     set archived_at = now(), archived_party_name = found.name, party_id = null
   where party_id = target;

  delete from public.parties where id = target;
end;
$$;

create or replace function public.copy_from_archive(sheet uuid, target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.characters;
  fresh uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into src from public.characters
   where id = sheet and user_id = auth.uid() and archived_at is not null;
  if src.id is null then
    raise exception 'That sheet is not in your Archive.';
  end if;
  if not public.is_party_member(target) then
    raise exception 'You are not in that party.';
  end if;
  if exists (select 1 from public.characters where party_id = target and user_id = auth.uid()) then
    raise exception 'You already have a sheet in this party.';
  end if;

  src.id := fresh;
  src.party_id := target;
  src.archived_at := null;
  src.archived_party_name := null;
  src.created_at := now();
  src.updated_at := now();
  insert into public.characters select (src).*;

  insert into public.character_weapons (character_id, name, damage, damage_type, to_hit, properties, description, in_hand, created_at)
  select fresh, name, damage, damage_type, to_hit, properties, description, in_hand, created_at
    from public.character_weapons where character_id = sheet;

  insert into public.character_spells (character_id, name, level, school, casting_time, range, verbal, somatic, material, material_text, duration, description, created_at)
  select fresh, name, level, school, casting_time, range, verbal, somatic, material, material_text, duration, description, created_at
    from public.character_spells where character_id = sheet;

  insert into public.character_equipment (character_id, name, quantity, notes, source, created_at)
  select fresh, name, quantity, notes, e.source, created_at
    from public.character_equipment e where character_id = sheet;

  insert into public.character_traits (character_id, name, source, created_at)
  select fresh, name, t.source, created_at
    from public.character_traits t where character_id = sheet;

  return fresh;
end;
$$;

create or replace function public.delete_archived(sheet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (
    select 1 from public.characters
     where id = sheet and user_id = auth.uid() and archived_at is not null
  ) then
    raise exception 'That sheet is not in your Archive.';
  end if;

  delete from public.characters where id = sheet and user_id = auth.uid() and archived_at is not null;
end;
$$;

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
    and c.archived_at is null
    and public.is_party_member(target)
  order by c.name
  limit 12;
$$;

revoke all on function public.leave_party(uuid) from public, anon;
revoke all on function public.transfer_dm(uuid, uuid) from public, anon;
revoke all on function public.delete_party(uuid) from public, anon;
revoke all on function public.copy_from_archive(uuid, uuid) from public, anon;
revoke all on function public.delete_archived(uuid) from public, anon;
revoke all on function public.party_sheets(uuid) from public, anon;
grant execute on function public.leave_party(uuid) to authenticated;
grant execute on function public.transfer_dm(uuid, uuid) to authenticated;
grant execute on function public.delete_party(uuid) to authenticated;
grant execute on function public.copy_from_archive(uuid, uuid) to authenticated;
grant execute on function public.delete_archived(uuid) to authenticated;
grant execute on function public.party_sheets(uuid) to authenticated;

-- Arkane Aid backend phase 1
-- Paste this into the Supabase SQL editor and run it once.
-- Assumes automatic RLS is on. Policies below are what actually allow access.
-- Email confirm is a dashboard switch, not SQL:
-- Authentication -> Providers -> Email -> turn off Confirm email for the milestone.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('dm', 'player')),
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.ledger_entries enable row level security;

create or replace function public.is_party_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.party_members
    where party_id = target
      and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_party(party_name text)
returns public.parties
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  created public.parties;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if party_name is null or char_length(trim(party_name)) < 2 then
    raise exception 'Party name is too short';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.parties where code = new_code);
  end loop;

  insert into public.parties (code, name, created_by)
  values (new_code, trim(party_name), auth.uid())
  returning * into created;

  insert into public.party_members (party_id, user_id, role)
  values (created.id, auth.uid(), 'dm');

  return created;
end;
$$;

create or replace function public.join_party(join_code text)
returns public.parties
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

  select * into found
  from public.parties
  where code = upper(trim(join_code));

  if found.id is null then
    raise exception 'No party with that code';
  end if;

  insert into public.party_members (party_id, user_id, role)
  values (found.id, auth.uid(), 'player')
  on conflict (party_id, user_id) do nothing;

  return found;
end;
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "members read party" on public.parties;
create policy "members read party"
  on public.parties for select
  to authenticated
  using (public.is_party_member(id));

drop policy if exists "members read roster" on public.party_members;
create policy "members read roster"
  on public.party_members for select
  to authenticated
  using (public.is_party_member(party_id));

drop policy if exists "members read ledger" on public.ledger_entries;
create policy "members read ledger"
  on public.ledger_entries for select
  to authenticated
  using (public.is_party_member(party_id));

drop policy if exists "members write ledger" on public.ledger_entries;
create policy "members write ledger"
  on public.ledger_entries for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_party_member(party_id)
  );

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.parties to authenticated;
grant select on public.party_members to authenticated;
grant select, insert on public.ledger_entries to authenticated;
grant execute on function public.create_party(text) to authenticated;
grant execute on function public.join_party(text) to authenticated;

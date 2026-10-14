-- Arkane Aid backend phase 4
-- Paste into the Supabase SQL editor and run once, after 003.
-- Safe to re-run.
--
-- Adds the rest of a normal 5e sheet:
--   armor class, speed, languages, class features / spells
--   skill proficiencies as a list of skill names
-- Proficiency bonus is not stored. It comes from level.

alter table public.characters add column if not exists ac int not null default 10;
alter table public.characters add column if not exists speed int not null default 30;
alter table public.characters add column if not exists languages text;
alter table public.characters add column if not exists features text;
alter table public.characters add column if not exists skills text[] not null default '{}';

alter table public.characters drop constraint if exists characters_ac_check;
alter table public.characters add constraint characters_ac_check check (ac between 0 and 30);

alter table public.characters drop constraint if exists characters_speed_check;
alter table public.characters add constraint characters_speed_check check (speed between 0 and 120);

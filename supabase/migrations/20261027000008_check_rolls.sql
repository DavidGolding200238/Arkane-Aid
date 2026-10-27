-- Arkane Aid: rolling checks from the Character Sheet (the dice pop-up's Check tab).
-- Applied by `npx supabase db push`. Safe to re-run.
--
-- 1. characters.expertise: the proficient skills with Expertise (double Proficiency Bonus).
-- 2. characters.save_profs: saving throws ticked on the sheet on top of the class's own,
--    as ability keys ("str", "dex", "con", "int", "wis", "cha").
-- 3. characters.jack_of_all_trades: half Proficiency Bonus on skills without proficiency.

alter table public.characters add column if not exists expertise text[] not null default '{}';
alter table public.characters add column if not exists save_profs text[] not null default '{}';
alter table public.characters add column if not exists jack_of_all_trades boolean not null default false;

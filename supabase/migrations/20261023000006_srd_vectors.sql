-- Arkane Aid backend phase 6: meaning search over the SRD for the Sage (free tier only).
-- Applied by `supabase db push`. Safe to re-run.
--
-- srd_chunks holds one row per embedded piece of SRD 5.2.1 (about 2,300 rows, a few MB).
-- chunk is the entry's index in supabase/functions/_shared/srd/srd-5.2.1.json, so the
-- function can map a match back to the bundled text; long entries are split into pieces
-- (piece 0, 1, ...) to stay under gte-small's 512-token limit.
-- Embeddings are gte-small (384 numbers, mean pooled and normalised), the model built into
-- Supabase Edge Functions. Rows are written once by scripts/srd-embed.ts with the service
-- role key, which bypasses Row Level Security; players can only read.

create extension if not exists vector with schema extensions;

create table if not exists public.srd_chunks (
  id bigint generated always as identity primary key,
  chunk integer not null,
  piece integer not null default 0,
  name text not null,
  citation text not null,
  text text not null,
  embedding extensions.vector(384) not null,
  unique (chunk, piece)
);

comment on table public.srd_chunks is
  'SRD 5.2.1 pieces with gte-small embeddings for the Sage. Seeded by scripts/srd-embed.ts. SRD 5.2.1 by Wizards of the Coast, CC-BY-4.0.';

-- Normalised vectors: inner product ranks the same as cosine and is cheaper.
create index if not exists srd_chunks_embedding_idx
  on public.srd_chunks using hnsw (embedding extensions.vector_ip_ops);

alter table public.srd_chunks enable row level security;

drop policy if exists "signed in read srd" on public.srd_chunks;
create policy "signed in read srd"
  on public.srd_chunks for select
  to authenticated
  using (true);

-- No write policies: only the service role (the seed script) can change rows.
revoke insert, update, delete, truncate on public.srd_chunks from anon, authenticated;
revoke all on public.srd_chunks from anon;

-- The closest SRD entries to a question embedding, best first, one row per entry.
-- Runs as the caller (security invoker), so RLS above applies: signed-in players only.
create or replace function public.match_srd(query_embedding extensions.vector(384), match_count integer default 8)
returns table (chunk integer, name text, similarity double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select nearest.chunk, min(nearest.name) as name, max(nearest.similarity) as similarity
  from (
    select s.chunk, s.name, -(s.embedding <#> query_embedding) as similarity
    from public.srd_chunks s
    order by s.embedding <#> query_embedding
    limit least(greatest(match_count, 1), 20) * 3
  ) as nearest
  group by nearest.chunk
  order by max(nearest.similarity) desc
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_srd(extensions.vector, integer) from public, anon;
grant execute on function public.match_srd(extensions.vector, integer) to authenticated;

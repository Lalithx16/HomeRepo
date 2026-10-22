-- Trigram indexes keep substring search fast as inventories grow.
create extension if not exists pg_trgm with schema extensions;

create index if not exists products_name_trgm_idx
  on public.products using gin (lower(name) extensions.gin_trgm_ops);
create index if not exists brands_name_trgm_idx
  on public.brands using gin (lower(name) extensions.gin_trgm_ops);
create index if not exists locations_name_trgm_idx
  on public.locations using gin (lower(name) extensions.gin_trgm_ops);

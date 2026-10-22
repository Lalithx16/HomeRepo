-- =============================================================================
-- Homebase core schema
-- Households -> members, categories, hierarchical locations, brands, products,
-- stock rules, inventory lots, inventory transactions, ratings, shopping lists,
-- recipes. Every household-owned table carries household_id for RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.household_role as enum ('owner', 'editor', 'viewer');
create type public.location_kind as enum ('room', 'storage', 'shelf', 'drawer', 'container', 'other');
create type public.txn_kind as enum ('create', 'add', 'purchase', 'consume', 'discard', 'adjust', 'move');
create type public.shopping_source as enum ('manual', 'low_stock', 'recipe');
create type public.recipe_difficulty as enum ('easy', 'medium', 'hard');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Increments a `version` column on every update; used for optimistic concurrency.
create or replace function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Units (global reference data). Base units: g (mass), ml (volume), pcs (count).
-- Package units ("pack", "can", ...) only convert to themselves.
-- ---------------------------------------------------------------------------
create table public.units (
  code text primary key check (code ~ '^[a-z_]{1,12}$'),
  label text not null,
  plural_label text not null,
  dimension text not null check (dimension in ('mass', 'volume', 'count', 'package')),
  to_base numeric(20, 10) not null check (to_base > 0),
  sort_order int not null default 0
);

insert into public.units (code, label, plural_label, dimension, to_base, sort_order) values
  ('pcs',    'piece',  'pieces',  'count',   1,            10),
  ('dozen',  'dozen',  'dozen',   'count',   12,           11),
  ('g',      'g',      'g',       'mass',    1,            20),
  ('kg',     'kg',     'kg',      'mass',    1000,         21),
  ('mg',     'mg',     'mg',      'mass',    0.001,        22),
  ('oz',     'oz',     'oz',      'mass',    28.349523125, 23),
  ('lb',     'lb',     'lb',      'mass',    453.59237,    24),
  ('ml',     'ml',     'ml',      'volume',  1,            30),
  ('l',      'L',      'L',       'volume',  1000,         31),
  ('tsp',    'tsp',    'tsp',     'volume',  4.92892,      32),
  ('tbsp',   'tbsp',   'tbsp',    'volume',  14.7868,      33),
  ('cup',    'cup',    'cups',    'volume',  240,          34),
  ('fl_oz',  'fl oz',  'fl oz',   'volume',  29.5735,      35),
  ('pack',   'pack',   'packs',   'package', 1,            40),
  ('can',    'can',    'cans',    'package', 1,            41),
  ('bottle', 'bottle', 'bottles', 'package', 1,            42),
  ('jar',    'jar',    'jars',    'package', 1,            43),
  ('box',    'box',    'boxes',   'package', 1,            44),
  ('bag',    'bag',    'bags',    'package', 1,            45),
  ('bunch',  'bunch',  'bunches', 'package', 1,            46),
  ('loaf',   'loaf',   'loaves',  'package', 1,            47);

create or replace function public.units_compatible(a text, b text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.units ua
    join public.units ub on ub.code = b
    where ua.code = a
      and ua.dimension = ub.dimension
      and (ua.dimension <> 'package' or ua.code = ub.code)
  );
$$;

create or replace function public.convert_quantity(q numeric, from_unit text, to_unit text)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  f numeric;
  t numeric;
begin
  if from_unit = to_unit then
    return q;
  end if;
  if not public.units_compatible(from_unit, to_unit) then
    raise exception 'incompatible_units' using detail = format('%s cannot be converted to %s', from_unit, to_unit);
  end if;
  select to_base into f from public.units where code = from_unit;
  select to_base into t from public.units where code = to_unit;
  return round(q * f / t, 3);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  expiry_warning_days int not null default 7 check (expiry_warning_days between 0 and 90),
  restock_multiplier numeric(4, 2) not null default 2 check (restock_multiplier between 1 and 10),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.households_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Raises invalid_parameter_value if the time zone name is unknown.
  perform now() at time zone new.timezone;
  new.name := btrim(new.name);
  return new;
end;
$$;

create trigger households_validate before insert or update on public.households
  for each row execute function public.households_validate();
create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- Second FK lets PostgREST embed member profiles (profiles.id = auth.users.id).
  constraint household_members_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade
);
create index household_members_user_idx on public.household_members (user_id);

-- A household must always keep at least one owner.
create or replace function public.household_members_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.households h where h.id = old.household_id)
     and not exists (
       select 1 from public.household_members m
       where m.household_id = old.household_id
         and m.role = 'owner'
         and m.user_id <> old.user_id
     ) then
    raise exception 'last_owner' using detail = 'A household needs at least one owner.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger household_members_keep_owner
  before update or delete on public.household_members
  for each row execute function public.household_members_keep_owner();

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.household_role not null default 'editor' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index household_invitations_household_idx on public.household_invitations (household_id);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default 'package' check (icon ~ '^[a-z-]{1,40}$'),
  store_section text check (store_section is null or char_length(store_section) <= 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_household_name_key on public.categories (household_id, lower(name));
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hierarchical locations (Home -> Kitchen -> Pantry -> Shelf 2 -> Container A)
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid references public.locations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.location_kind not null default 'storage',
  notes text check (notes is null or char_length(notes) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create unique index locations_sibling_name_key on public.locations (
  household_id,
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);
create index locations_parent_idx on public.locations (parent_id);
create index locations_household_idx on public.locations (household_id);
create trigger locations_touch before update on public.locations
  for each row execute function public.touch_updated_at();

-- Validates parent household and rejects circular parent/child relationships.
create or replace function public.locations_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  depth int;
  cycle_found boolean;
begin
  new.name := btrim(new.name);
  if new.parent_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.locations p
    where p.id = new.parent_id and p.household_id = new.household_id
  ) then
    raise exception 'invalid_parent' using detail = 'Parent location must belong to the same household.';
  end if;

  with recursive ancestors as (
    select l.id, l.parent_id, 1 as lvl
    from public.locations l
    where l.id = new.parent_id
    union all
    select l.id, l.parent_id, a.lvl + 1
    from public.locations l
    join ancestors a on l.id = a.parent_id
    where a.lvl < 50
  )
  select bool_or(a.id = new.id), max(a.lvl) into cycle_found, depth from ancestors a;

  if coalesce(cycle_found, false) then
    raise exception 'location_cycle' using detail = 'A location cannot be placed inside itself or one of its own sub-locations.';
  end if;
  if depth >= 8 then
    raise exception 'location_too_deep' using detail = 'Locations can be nested at most 8 levels deep.';
  end if;
  return new;
end;
$$;

create trigger locations_validate before insert or update of parent_id, household_id, name on public.locations
  for each row execute function public.locations_validate();

-- ---------------------------------------------------------------------------
-- Brands & products
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index brands_household_name_key on public.brands (household_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  default_unit text not null references public.units (code),
  ingredient_key text check (ingredient_key is null or ingredient_key ~ '^[a-z0-9 ]{1,40}$'),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  notes text check (notes is null or char_length(notes) <= 2000),
  version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Duplicate protection: same name + brand cannot be tracked twice in a household.
create unique index products_identity_key on public.products (
  household_id,
  lower(name),
  coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index products_household_idx on public.products (household_id);
create index products_category_idx on public.products (category_id);
create trigger products_version before update on public.products
  for each row execute function public.bump_version();

create or replace function public.products_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if new.brand_id is not null and not exists (
    select 1 from public.brands b where b.id = new.brand_id and b.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Brand belongs to another household.';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Category belongs to another household.';
  end if;
  if tg_op = 'UPDATE' and new.default_unit <> old.default_unit and exists (
    select 1 from public.inventory_lots l
    where l.product_id = new.id and not public.units_compatible(l.unit, new.default_unit)
  ) then
    raise exception 'incompatible_units' using detail = 'Existing batches use a unit that cannot be converted to the new unit.';
  end if;
  return new;
end;
$$;

-- Stock thresholds / restock rules (one per product, expressed in a unit compatible with the product).
create table public.stock_rules (
  product_id uuid primary key references public.products (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  min_quantity numeric(12, 3) not null check (min_quantity >= 0),
  target_quantity numeric(12, 3) check (target_quantity is null or target_quantity >= min_quantity),
  unit text not null references public.units (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stock_rules_household_idx on public.stock_rules (household_id);
create trigger stock_rules_touch before update on public.stock_rules
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory lots (a batch of a product in one location with one expiry date)
-- ---------------------------------------------------------------------------
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity >= 0),
  unit text not null references public.units (code),
  expiry_date date,
  purchase_date date,
  notes text check (notes is null or char_length(notes) <= 500),
  version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_lots_product_idx on public.inventory_lots (product_id);
create index inventory_lots_location_idx on public.inventory_lots (location_id);
create index inventory_lots_expiry_idx on public.inventory_lots (household_id, expiry_date) where expiry_date is not null and quantity > 0;
create trigger inventory_lots_version before update on public.inventory_lots
  for each row execute function public.bump_version();

create or replace function public.inventory_lots_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p_unit text;
begin
  select p.default_unit into p_unit
  from public.products p
  where p.id = new.product_id and p.household_id = new.household_id;
  if p_unit is null then
    raise exception 'invalid_reference' using detail = 'Product belongs to another household.';
  end if;
  if not exists (
    select 1 from public.locations l where l.id = new.location_id and l.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Location belongs to another household.';
  end if;
  if not public.units_compatible(new.unit, p_unit) then
    raise exception 'incompatible_units' using detail = format('Unit %s is not compatible with %s.', new.unit, p_unit);
  end if;
  return new;
end;
$$;

create trigger inventory_lots_validate before insert or update of product_id, location_id, unit, household_id on public.inventory_lots
  for each row execute function public.inventory_lots_validate();

create trigger products_validate before insert or update on public.products
  for each row execute function public.products_validate();

create or replace function public.stock_rules_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p_unit text;
begin
  select p.default_unit into p_unit
  from public.products p
  where p.id = new.product_id and p.household_id = new.household_id;
  if p_unit is null then
    raise exception 'invalid_reference' using detail = 'Product belongs to another household.';
  end if;
  if not public.units_compatible(new.unit, p_unit) then
    raise exception 'incompatible_units' using detail = 'Threshold unit must be compatible with the product unit.';
  end if;
  return new;
end;
$$;

create trigger stock_rules_validate before insert or update on public.stock_rules
  for each row execute function public.stock_rules_validate();

-- ---------------------------------------------------------------------------
-- Inventory transactions (append-only audit log; no update/delete policies)
-- ---------------------------------------------------------------------------
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  lot_id uuid references public.inventory_lots (id) on delete set null,
  product_name text not null,
  kind public.txn_kind not null,
  quantity_delta numeric(12, 3) not null,
  unit text not null references public.units (code),
  quantity_after numeric(12, 3),
  from_location_id uuid references public.locations (id) on delete set null,
  to_location_id uuid references public.locations (id) on delete set null,
  total_price numeric(12, 2) check (total_price is null or total_price >= 0),
  note text check (note is null or char_length(note) <= 500),
  client_mutation_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index inventory_transactions_mutation_key
  on public.inventory_transactions (client_mutation_id) where client_mutation_id is not null;
create index inventory_transactions_household_time_idx on public.inventory_transactions (household_id, created_at desc);
create index inventory_transactions_product_time_idx on public.inventory_transactions (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------
create table public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id),
  constraint product_ratings_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade
);
create index product_ratings_household_idx on public.product_ratings (household_id);
create trigger product_ratings_touch before update on public.product_ratings
  for each row execute function public.touch_updated_at();

create table public.brand_ratings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, user_id),
  constraint brand_ratings_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade
);
create index brand_ratings_household_idx on public.brand_ratings (household_id);
create trigger brand_ratings_touch before update on public.brand_ratings
  for each row execute function public.touch_updated_at();

create or replace function public.product_ratings_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.products p where p.id = new.product_id and p.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Product belongs to another household.';
  end if;
  return new;
end;
$$;

create or replace function public.brand_ratings_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.brands b where b.id = new.brand_id and b.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Brand belongs to another household.';
  end if;
  return new;
end;
$$;
create trigger product_ratings_validate before insert or update on public.product_ratings
  for each row execute function public.product_ratings_validate();
create trigger brand_ratings_validate before insert or update on public.brand_ratings
  for each row execute function public.brand_ratings_validate();

-- ---------------------------------------------------------------------------
-- Recipes (household_id NULL = built-in catalog visible to everyone)
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  image_url text,
  icon text not null default 'chef-hat',
  cuisine text,
  prep_minutes int not null default 0 check (prep_minutes >= 0),
  cook_minutes int not null default 0 check (cook_minutes >= 0),
  servings int not null default 2 check (servings > 0),
  difficulty public.recipe_difficulty not null default 'easy',
  diets text[] not null default '{}',
  instructions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipes_slug_key on public.recipes (
  coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), slug
);
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null default 0,
  ingredient_key text not null check (ingredient_key ~ '^[a-z0-9 ]{1,40}$'),
  display_name text not null,
  quantity numeric(10, 3) check (quantity is null or quantity > 0),
  unit text references public.units (code),
  optional boolean not null default false,
  note text,
  check ((quantity is null) = (unit is null))
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

create table public.recipe_favorites (
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Shopping lists
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null default 'Shopping list' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_lists_household_idx on public.shopping_lists (household_id);
create trigger shopping_lists_touch before update on public.shopping_lists
  for each row execute function public.touch_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit text not null default 'pcs' references public.units (code),
  notes text check (notes is null or char_length(notes) <= 300),
  source public.shopping_source not null default 'manual',
  recipe_id uuid references public.recipes (id) on delete set null,
  checked_at timestamptz,
  checked_by uuid references auth.users (id) on delete set null,
  removed_at timestamptz,
  purchased_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_list_items_open_idx on public.shopping_list_items (list_id)
  where removed_at is null and purchased_at is null;
create index shopping_list_items_household_idx on public.shopping_list_items (household_id);
create trigger shopping_list_items_touch before update on public.shopping_list_items
  for each row execute function public.touch_updated_at();

create or replace function public.shopping_items_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if not exists (
    select 1 from public.shopping_lists s where s.id = new.list_id and s.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'List belongs to another household.';
  end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p where p.id = new.product_id and p.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Product belongs to another household.';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id
  ) then
    raise exception 'invalid_reference' using detail = 'Category belongs to another household.';
  end if;
  return new;
end;
$$;
create trigger shopping_items_validate before insert or update of list_id, product_id, category_id, household_id, name
  on public.shopping_list_items
  for each row execute function public.shopping_items_validate();

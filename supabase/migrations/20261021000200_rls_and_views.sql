-- =============================================================================
-- Row Level Security
-- Every household-owned table is readable by members and writable by
-- owners/editors. Viewers are read-only. Nothing is accessible to `anon`.
-- =============================================================================

-- Membership check. SECURITY DEFINER so policies on household_members do not
-- recurse; it only ever answers questions about the *calling* user.
create or replace function public.has_household_role(
  hid uuid,
  roles public.household_role[] default array['owner', 'editor', 'viewer']::public.household_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
      and m.role = any (roles)
  );
$$;

create or replace function public.can_edit_household(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_household_role(hid, array['owner', 'editor']::public.household_role[]);
$$;

create or replace function public.shares_household_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges: anon gets nothing; authenticated gets table privileges that are
-- then narrowed row-by-row by policies.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.units from authenticated;
revoke update, delete on public.inventory_transactions from authenticated;
grant execute on function public.has_household_role(uuid, public.household_role[]) to authenticated;
grant execute on function public.can_edit_household(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;
grant execute on function public.units_compatible(text, text) to authenticated;
grant execute on function public.convert_quantity(numeric, text, text) to authenticated;

alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.stock_rules enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.product_ratings enable row level security;
alter table public.brand_ratings enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_favorites enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- Units: reference data
create policy units_read on public.units for select to authenticated using (true);

-- Profiles: yourself and people you share a household with
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Households: created through create_household(); owners manage settings
create policy households_read on public.households for select to authenticated
  using (public.has_household_role(id));
create policy households_update on public.households for update to authenticated
  using (public.has_household_role(id, array['owner']::public.household_role[]))
  with check (public.has_household_role(id, array['owner']::public.household_role[]));
create policy households_delete on public.households for delete to authenticated
  using (public.has_household_role(id, array['owner']::public.household_role[]));

-- Members: visible to co-members; owners manage; anyone may leave
create policy members_read on public.household_members for select to authenticated
  using (public.has_household_role(household_id));
create policy members_update on public.household_members for update to authenticated
  using (public.has_household_role(household_id, array['owner']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner']::public.household_role[]));
create policy members_delete on public.household_members for delete to authenticated
  using (
    user_id = auth.uid()
    or public.has_household_role(household_id, array['owner']::public.household_role[])
  );
-- (No insert policy: membership is only created by create_household / accept_invitation.)

-- Invitations: owners only
create policy invitations_owner_all on public.household_invitations for all to authenticated
  using (public.has_household_role(household_id, array['owner']::public.household_role[]))
  with check (
    public.has_household_role(household_id, array['owner']::public.household_role[])
    and invited_by = auth.uid()
  );

-- Standard household-owned tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'locations', 'brands', 'products', 'stock_rules',
    'inventory_lots', 'shopping_lists', 'shopping_list_items'
  ] loop
    execute format(
      'create policy %1$s_read on public.%1$s for select to authenticated using (public.has_household_role(household_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.can_edit_household(household_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated using (public.can_edit_household(household_id))', t);
  end loop;
end;
$$;

-- Transactions: append-only, attributed to the caller
create policy transactions_read on public.inventory_transactions for select to authenticated
  using (public.has_household_role(household_id));
create policy transactions_insert on public.inventory_transactions for insert to authenticated
  with check (public.can_edit_household(household_id) and created_by = auth.uid());

-- Ratings: every member may rate; you can only change your own rating
create policy product_ratings_read on public.product_ratings for select to authenticated
  using (public.has_household_role(household_id));
create policy product_ratings_write on public.product_ratings for insert to authenticated
  with check (user_id = auth.uid() and public.has_household_role(household_id));
create policy product_ratings_update on public.product_ratings for update to authenticated
  using (user_id = auth.uid() and public.has_household_role(household_id))
  with check (user_id = auth.uid() and public.has_household_role(household_id));
create policy product_ratings_delete on public.product_ratings for delete to authenticated
  using (user_id = auth.uid());

create policy brand_ratings_read on public.brand_ratings for select to authenticated
  using (public.has_household_role(household_id));
create policy brand_ratings_write on public.brand_ratings for insert to authenticated
  with check (user_id = auth.uid() and public.has_household_role(household_id));
create policy brand_ratings_update on public.brand_ratings for update to authenticated
  using (user_id = auth.uid() and public.has_household_role(household_id))
  with check (user_id = auth.uid() and public.has_household_role(household_id));
create policy brand_ratings_delete on public.brand_ratings for delete to authenticated
  using (user_id = auth.uid());

-- Recipes: built-in catalog is readable by all signed-in users; household recipes by members
create policy recipes_read on public.recipes for select to authenticated
  using (household_id is null or public.has_household_role(household_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (household_id is not null and public.can_edit_household(household_id));
create policy recipes_update on public.recipes for update to authenticated
  using (household_id is not null and public.can_edit_household(household_id))
  with check (household_id is not null and public.can_edit_household(household_id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (household_id is not null and public.can_edit_household(household_id));

create policy recipe_ingredients_read on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and (r.household_id is null or public.has_household_role(r.household_id))
  ));
create policy recipe_ingredients_write on public.recipe_ingredients for all to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.household_id is not null and public.can_edit_household(r.household_id)
  ))
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.household_id is not null and public.can_edit_household(r.household_id)
  ));

create policy recipe_favorites_read on public.recipe_favorites for select to authenticated
  using (public.has_household_role(household_id));
create policy recipe_favorites_insert on public.recipe_favorites for insert to authenticated
  with check (user_id = auth.uid() and public.has_household_role(household_id));
create policy recipe_favorites_delete on public.recipe_favorites for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- Read models (views run with the caller's privileges => RLS applies)
-- =============================================================================

-- Today's date in the household's own time zone.
create or replace function public.household_today(hid uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone h.timezone)::date from public.households h where h.id = hid;
$$;
grant execute on function public.household_today(uuid) to authenticated;

create or replace view public.lot_details
with (security_invoker = true)
as
select
  l.id,
  l.household_id,
  l.product_id,
  p.name as product_name,
  b.name as brand_name,
  p.category_id,
  c.name as category_name,
  c.icon as category_icon,
  p.image_path,
  l.location_id,
  loc.name as location_name,
  l.quantity,
  l.unit,
  l.expiry_date,
  l.purchase_date,
  l.notes,
  l.version,
  l.created_at,
  l.updated_at,
  (l.expiry_date - (now() at time zone h.timezone)::date) as days_until_expiry,
  case
    when l.expiry_date is null or l.quantity = 0 then 'none'
    when l.expiry_date < (now() at time zone h.timezone)::date then 'expired'
    when l.expiry_date <= (now() at time zone h.timezone)::date + h.expiry_warning_days then 'expiring'
    else 'fresh'
  end as expiry_status
from public.inventory_lots l
join public.products p on p.id = l.product_id
join public.households h on h.id = l.household_id
join public.locations loc on loc.id = l.location_id
left join public.brands b on b.id = p.brand_id
left join public.categories c on c.id = p.category_id;

create or replace view public.product_stock
with (security_invoker = true)
as
select
  p.id,
  p.household_id,
  p.name,
  p.brand_id,
  b.name as brand_name,
  p.category_id,
  c.name as category_name,
  c.icon as category_icon,
  c.store_section,
  p.default_unit,
  p.ingredient_key,
  p.image_path,
  p.notes,
  p.version,
  p.created_at,
  greatest(p.updated_at, coalesce(agg.last_lot_update, p.updated_at)) as updated_at,
  coalesce(agg.total_quantity, 0)::numeric(14, 3) as total_quantity,
  coalesce(agg.lot_count, 0)::int as lot_count,
  coalesce(agg.all_lot_count, 0)::int as all_lot_count,
  agg.single_lot_id,
  agg.single_lot_quantity,
  agg.single_lot_unit,
  coalesce(agg.location_ids, '{}'::uuid[]) as location_ids,
  agg.location_names,
  agg.earliest_expiry,
  case when sr.product_id is null then null
       else round(sr.min_quantity * su.to_base / du.to_base, 3) end as min_quantity,
  case when sr.target_quantity is null then null
       else round(sr.target_quantity * su.to_base / du.to_base, 3) end as target_quantity,
  case
    when coalesce(agg.total_quantity, 0) = 0 then 'out'
    when sr.product_id is not null
         and coalesce(agg.total_quantity, 0) < round(sr.min_quantity * su.to_base / du.to_base, 3) then 'low'
    else 'ok'
  end as stock_status,
  (sr.product_id is not null
    and coalesce(agg.total_quantity, 0) < round(sr.min_quantity * su.to_base / du.to_base, 3)) as needs_restock,
  case
    when agg.earliest_expiry is null then 'none'
    when agg.earliest_expiry < (now() at time zone h.timezone)::date then 'expired'
    when agg.earliest_expiry <= (now() at time zone h.timezone)::date + h.expiry_warning_days then 'expiring'
    else 'fresh'
  end as expiry_status,
  lower(concat_ws(' ', p.name, b.name, c.name, p.ingredient_key, agg.location_names)) as search_text
from public.products p
join public.households h on h.id = p.household_id
join public.units du on du.code = p.default_unit
left join public.brands b on b.id = p.brand_id
left join public.categories c on c.id = p.category_id
left join public.stock_rules sr on sr.product_id = p.id
left join public.units su on su.code = sr.unit
left join lateral (
  select
    round(sum(l.quantity * lu.to_base / du.to_base), 3) as total_quantity,
    count(*) filter (where l.quantity > 0) as lot_count,
    count(*) as all_lot_count,
    case when count(*) = 1 then (array_agg(l.id))[1] end as single_lot_id,
    case when count(*) = 1 then (array_agg(l.quantity))[1] end as single_lot_quantity,
    case when count(*) = 1 then (array_agg(l.unit))[1] end as single_lot_unit,
    array_agg(distinct l.location_id) filter (where l.quantity > 0) as location_ids,
    string_agg(distinct loc.name, ', ') filter (where l.quantity > 0) as location_names,
    min(l.expiry_date) filter (where l.quantity > 0) as earliest_expiry,
    max(l.updated_at) as last_lot_update
  from public.inventory_lots l
  join public.units lu on lu.code = l.unit
  join public.locations loc on loc.id = l.location_id
  where l.product_id = p.id
) agg on true;

create or replace view public.location_stock
with (security_invoker = true)
as
select
  loc.id,
  loc.household_id,
  loc.parent_id,
  loc.name,
  loc.kind,
  loc.notes,
  loc.sort_order,
  coalesce(cnt.lot_count, 0)::int as lot_count,
  coalesce(cnt.product_count, 0)::int as product_count
from public.locations loc
left join lateral (
  select count(*) as lot_count, count(distinct l.product_id) as product_count
  from public.inventory_lots l
  where l.location_id = loc.id and l.quantity > 0
) cnt on true;

grant select on public.lot_details, public.product_stock, public.location_stock to authenticated;
revoke all on public.lot_details, public.product_stock, public.location_stock from anon;

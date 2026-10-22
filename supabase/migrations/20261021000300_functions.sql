-- =============================================================================
-- Transactional operations.
-- All functions except create_household / accept_invitation are SECURITY
-- INVOKER, so Row Level Security applies to every statement they run.
-- Each function body executes atomically in a single transaction.
-- Error messages are stable machine codes; the app maps them to friendly text.
-- =============================================================================

-- Raises unless the caller is an owner/editor of the household.
create or replace function public.assert_can_edit(hid uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.can_edit_household(hid) then
    raise exception 'forbidden' using detail = 'You do not have permission to change this household.';
  end if;
end;
$$;

-- Household of a lot (visible to members), or raises lot_not_found.
create or replace function public.lot_household(p_lot_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.inventory_lots where id = p_lot_id;
  if hid is null then
    raise exception 'lot_not_found' using detail = 'This batch no longer exists.';
  end if;
  return hid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------
create or replace function public.create_household(
  p_name text,
  p_timezone text default 'UTC',
  p_currency text default 'USD',
  p_seed_defaults boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  kitchen uuid;
  pantry uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if (select count(*) from public.household_members m where m.user_id = uid) >= 20 then
    raise exception 'too_many_households' using detail = 'You can belong to at most 20 households.';
  end if;

  insert into public.households (name, timezone, currency, created_by)
  values (p_name, coalesce(nullif(p_timezone, ''), 'UTC'), upper(coalesce(nullif(p_currency, ''), 'USD')), uid)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'owner');
  insert into public.shopping_lists (household_id, name) values (hid, 'Shopping list');

  if p_seed_defaults then
    insert into public.categories (household_id, name, icon, store_section, sort_order) values
      (hid, 'Produce',            'carrot',      'Fresh produce',      10),
      (hid, 'Dairy & Eggs',       'milk',        'Dairy',              20),
      (hid, 'Meat & Seafood',     'beef',        'Meat & fish',        30),
      (hid, 'Bakery',             'croissant',   'Bakery',             40),
      (hid, 'Grains & Pasta',     'wheat',       'Dry goods',          50),
      (hid, 'Pulses & Legumes',   'bean',        'Dry goods',          60),
      (hid, 'Spices & Herbs',     'leaf',        'Spices',             70),
      (hid, 'Oils & Condiments',  'droplet',     'Oils & sauces',      80),
      (hid, 'Canned & Jarred',    'archive',     'Canned goods',       90),
      (hid, 'Baking',             'cake-slice',  'Baking',            100),
      (hid, 'Snacks',             'cookie',      'Snacks',            110),
      (hid, 'Beverages',          'coffee',      'Beverages',         120),
      (hid, 'Frozen',             'snowflake',   'Frozen',            130),
      (hid, 'Household',          'spray-can',   'Household',         140),
      (hid, 'Other',              'package',     'Other',             150);

    insert into public.locations (household_id, name, kind, sort_order)
      values (hid, 'Kitchen', 'room', 10) returning id into kitchen;
    insert into public.locations (household_id, parent_id, name, kind, sort_order)
      values (hid, kitchen, 'Pantry', 'storage', 10) returning id into pantry;
    insert into public.locations (household_id, parent_id, name, kind, sort_order) values
      (hid, kitchen, 'Refrigerator', 'storage', 20),
      (hid, kitchen, 'Freezer',      'storage', 30),
      (hid, kitchen, 'Cabinets',     'storage', 40),
      (hid, kitchen, 'Spice drawer', 'drawer',  50),
      (hid, pantry,  'Shelf 1',      'shelf',   10),
      (hid, pantry,  'Shelf 2',      'shelf',   20);
  end if;

  return hid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_household uuid,
  p_email text,
  p_role public.household_role default 'editor'
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  raw_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.has_household_role(p_household, array['owner']::public.household_role[]) then
    raise exception 'forbidden' using detail = 'Only owners can invite members.';
  end if;
  if p_role = 'owner' then
    raise exception 'invalid_role';
  end if;
  -- Revoke any previous open invitation for the same email.
  update public.household_invitations
     set revoked_at = now()
   where household_id = p_household
     and email = lower(btrim(p_email))
     and accepted_at is null
     and revoked_at is null;

  insert into public.household_invitations (household_id, email, role, token_hash, invited_by)
  values (p_household, lower(btrim(p_email)), p_role, encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'), auth.uid());
  return raw_token;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv public.household_invitations%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into inv
  from public.household_invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid' using detail = 'This invitation link is not valid.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation_used' using detail = 'This invitation has already been used.';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation_expired' using detail = 'This invitation has expired.';
  end if;
  if inv.email <> caller_email then
    raise exception 'invitation_email_mismatch'
      using detail = 'This invitation was sent to a different email address.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, inv.role)
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
     set accepted_at = now(), accepted_by = uid
   where id = inv.id;

  return inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
create or replace function public.ensure_brand(p_household uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  bid uuid;
  clean text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if clean is null then
    return null;
  end if;
  select id into bid from public.brands where household_id = p_household and lower(name) = lower(clean);
  if bid is null then
    insert into public.brands (household_id, name) values (p_household, clean)
    on conflict (household_id, lower(name)) do update set name = public.brands.name
    returning id into bid;
  end if;
  return bid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock: add (merges into an existing lot with the same location + expiry)
-- ---------------------------------------------------------------------------
create or replace function public.add_stock(
  p_product_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_unit text,
  p_expiry_date date default null,
  p_purchase_date date default null,
  p_total_price numeric default null,
  p_note text default null,
  p_kind public.txn_kind default 'add',
  p_client_mutation_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  prod public.products%rowtype;
  lot public.inventory_lots%rowtype;
  added numeric;
begin
  if p_client_mutation_id is not null then
    select lot_id into lot.id from public.inventory_transactions where client_mutation_id = p_client_mutation_id;
    if found then
      return lot.id;
    end if;
  end if;

  select * into prod from public.products where id = p_product_id;
  if not found then
    raise exception 'not_found' using detail = 'Product not found.';
  end if;
  perform public.assert_can_edit(prod.household_id);

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity' using detail = 'Quantity must be greater than zero.';
  end if;
  if p_kind not in ('add', 'purchase', 'create') then
    raise exception 'invalid_kind';
  end if;

  select * into lot
  from public.inventory_lots l
  where l.product_id = p_product_id
    and l.location_id = p_location_id
    and l.expiry_date is not distinct from p_expiry_date
    and public.units_compatible(l.unit, p_unit)
  order by l.updated_at desc
  limit 1
  for update;

  if found then
    added := public.convert_quantity(p_quantity, p_unit, lot.unit);
    update public.inventory_lots
       set quantity = quantity + added,
           purchase_date = coalesce(p_purchase_date, purchase_date)
     where id = lot.id
    returning * into lot;
  else
    added := p_quantity;
    insert into public.inventory_lots (household_id, product_id, location_id, quantity, unit, expiry_date, purchase_date, created_by)
    values (prod.household_id, p_product_id, p_location_id, p_quantity, p_unit, p_expiry_date, p_purchase_date, auth.uid())
    returning * into lot;
  end if;

  insert into public.inventory_transactions (
    household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
    to_location_id, total_price, note, client_mutation_id, created_by
  ) values (
    prod.household_id, prod.id, lot.id, prod.name, p_kind, added, lot.unit, lot.quantity,
    p_location_id, p_total_price, nullif(btrim(coalesce(p_note, '')), ''), p_client_mutation_id, auth.uid()
  );

  return lot.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create a product (+ optional rule + first lot) atomically
-- ---------------------------------------------------------------------------
create or replace function public.create_item(
  p_household uuid,
  p_name text,
  p_brand_name text,
  p_category_id uuid,
  p_unit text,
  p_quantity numeric,
  p_location_id uuid,
  p_expiry_date date default null,
  p_purchase_date date default null,
  p_total_price numeric default null,
  p_min_quantity numeric default null,
  p_target_quantity numeric default null,
  p_ingredient_key text default null,
  p_notes text default null,
  p_image_path text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  pid uuid;
begin
  perform public.assert_can_edit(p_household);

  insert into public.products (household_id, name, brand_id, category_id, default_unit, ingredient_key, notes, image_path, created_by)
  values (
    p_household, p_name, public.ensure_brand(p_household, p_brand_name), p_category_id, p_unit,
    nullif(lower(btrim(coalesce(p_ingredient_key, ''))), ''), nullif(btrim(coalesce(p_notes, '')), ''), p_image_path, auth.uid()
  )
  returning id into pid;

  if p_min_quantity is not null then
    insert into public.stock_rules (product_id, household_id, min_quantity, target_quantity, unit)
    values (pid, p_household, p_min_quantity, p_target_quantity, p_unit);
  end if;

  if p_quantity is not null and p_quantity > 0 then
    perform public.add_stock(pid, p_location_id, p_quantity, p_unit, p_expiry_date, p_purchase_date, p_total_price, null, 'create');
  elsif p_location_id is not null then
    -- Track an empty batch so the product has a home location.
    insert into public.inventory_lots (household_id, product_id, location_id, quantity, unit, expiry_date, purchase_date, created_by)
    values (p_household, pid, p_location_id, 0, p_unit, p_expiry_date, p_purchase_date, auth.uid());
  end if;

  return pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update product details (+ rule) with optimistic concurrency
-- ---------------------------------------------------------------------------
create or replace function public.update_product(
  p_product_id uuid,
  p_expected_version int,
  p_name text,
  p_brand_name text,
  p_category_id uuid,
  p_unit text,
  p_min_quantity numeric default null,
  p_target_quantity numeric default null,
  p_ingredient_key text default null,
  p_notes text default null,
  p_image_path text default null,
  p_clear_image boolean default false
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  prod public.products%rowtype;
begin
  select household_id into prod.household_id from public.products where id = p_product_id;
  if not found then
    raise exception 'not_found' using detail = 'Product not found.';
  end if;
  perform public.assert_can_edit(prod.household_id);
  select * into prod from public.products where id = p_product_id for update;
  if prod.version <> p_expected_version then
    raise exception 'version_conflict' using detail = 'This item was changed by someone else. Reload to see the latest version.';
  end if;

  update public.products
     set name = p_name,
         brand_id = public.ensure_brand(prod.household_id, p_brand_name),
         category_id = p_category_id,
         default_unit = p_unit,
         ingredient_key = nullif(lower(btrim(coalesce(p_ingredient_key, ''))), ''),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         image_path = case when p_clear_image then null else coalesce(p_image_path, image_path) end
   where id = p_product_id
  returning * into prod;

  if p_min_quantity is null then
    delete from public.stock_rules where product_id = p_product_id;
  else
    insert into public.stock_rules (product_id, household_id, min_quantity, target_quantity, unit)
    values (p_product_id, prod.household_id, p_min_quantity, p_target_quantity, p_unit)
    on conflict (product_id) do update
      set min_quantity = excluded.min_quantity,
          target_quantity = excluded.target_quantity,
          unit = excluded.unit;
  end if;

  return prod.version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Adjust a lot by a delta (add / consume / discard). Idempotent per mutation id.
-- Row is locked (FOR UPDATE) so concurrent updates serialize safely.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_lot(
  p_lot_id uuid,
  p_delta numeric,
  p_kind public.txn_kind,
  p_note text default null,
  p_client_mutation_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lot public.inventory_lots%rowtype;
  prod_name text;
  existing record;
  new_qty numeric;
begin
  if p_client_mutation_id is not null then
    select quantity_after into existing from public.inventory_transactions where client_mutation_id = p_client_mutation_id;
    if found then
      return jsonb_build_object('status', 'duplicate', 'quantity', existing.quantity_after);
    end if;
  end if;

  if p_kind not in ('add', 'consume', 'discard') then
    raise exception 'invalid_kind';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_quantity' using detail = 'Change must not be zero.';
  end if;
  if (p_kind = 'add' and p_delta < 0) or (p_kind in ('consume', 'discard') and p_delta > 0) then
    raise exception 'invalid_quantity' using detail = 'Sign of the change does not match the action.';
  end if;

  perform public.assert_can_edit(public.lot_household(p_lot_id));
  select * into lot from public.inventory_lots where id = p_lot_id for update;
  if not found then
    raise exception 'lot_not_found' using detail = 'This batch no longer exists.';
  end if;

  new_qty := lot.quantity + p_delta;
  if new_qty < 0 then
    raise exception 'insufficient_quantity'
      using detail = format('Only %s %s left.', trim(trailing '.' from trim(trailing '0' from lot.quantity::text)), lot.unit);
  end if;

  update public.inventory_lots set quantity = new_qty where id = lot.id;
  select name into prod_name from public.products where id = lot.product_id;

  insert into public.inventory_transactions (
    household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
    from_location_id, note, client_mutation_id, created_by
  ) values (
    lot.household_id, lot.product_id, lot.id, prod_name, p_kind, p_delta, lot.unit, new_qty,
    lot.location_id, nullif(btrim(coalesce(p_note, '')), ''), p_client_mutation_id, auth.uid()
  );

  return jsonb_build_object('status', 'applied', 'quantity', new_qty);
end;
$$;

-- Correct an incorrect count to an absolute value (an explicit adjustment).
create or replace function public.set_lot_quantity(
  p_lot_id uuid,
  p_quantity numeric,
  p_expected_version int default null,
  p_note text default null
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  lot public.inventory_lots%rowtype;
  prod_name text;
begin
  if p_quantity is null or p_quantity < 0 then
    raise exception 'invalid_quantity' using detail = 'Quantity cannot be negative.';
  end if;
  perform public.assert_can_edit(public.lot_household(p_lot_id));
  select * into lot from public.inventory_lots where id = p_lot_id for update;
  if not found then
    raise exception 'lot_not_found' using detail = 'This batch no longer exists.';
  end if;
  if p_expected_version is not null and lot.version <> p_expected_version then
    raise exception 'version_conflict' using detail = 'This batch was changed by someone else. Reload and try again.';
  end if;
  if lot.quantity = p_quantity then
    return lot.quantity;
  end if;

  update public.inventory_lots set quantity = p_quantity where id = lot.id;
  select name into prod_name from public.products where id = lot.product_id;
  insert into public.inventory_transactions (
    household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
    from_location_id, note, created_by
  ) values (
    lot.household_id, lot.product_id, lot.id, prod_name, 'adjust', p_quantity - lot.quantity, lot.unit, p_quantity,
    lot.location_id, coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Count corrected'), auth.uid()
  );
  return p_quantity;
end;
$$;

-- Move all or part of a lot to another location.
create or replace function public.move_lot(
  p_lot_id uuid,
  p_to_location uuid,
  p_quantity numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  lot public.inventory_lots%rowtype;
  target public.inventory_lots%rowtype;
  prod_name text;
  moving numeric;
begin
  perform public.assert_can_edit(public.lot_household(p_lot_id));
  select * into lot from public.inventory_lots where id = p_lot_id for update;
  if not found then
    raise exception 'lot_not_found' using detail = 'This batch no longer exists.';
  end if;
  if not exists (select 1 from public.locations where id = p_to_location and household_id = lot.household_id) then
    raise exception 'invalid_reference' using detail = 'Destination location not found.';
  end if;
  if p_to_location = lot.location_id then
    return lot.id;
  end if;

  moving := coalesce(p_quantity, lot.quantity);
  if moving <= 0 and lot.quantity > 0 then
    raise exception 'invalid_quantity' using detail = 'Choose an amount to move.';
  end if;
  if moving > lot.quantity then
    raise exception 'insufficient_quantity' using detail = 'You cannot move more than you have.';
  end if;

  select name into prod_name from public.products where id = lot.product_id;

  -- Merge with a lot at the destination with the same expiry, if any.
  select * into target
  from public.inventory_lots l
  where l.product_id = lot.product_id
    and l.location_id = p_to_location
    and l.expiry_date is not distinct from lot.expiry_date
    and l.unit = lot.unit
    and l.id <> lot.id
  limit 1
  for update;

  if moving = lot.quantity and target.id is null then
    update public.inventory_lots set location_id = p_to_location where id = lot.id returning * into target;
  else
    if target.id is null then
      insert into public.inventory_lots (household_id, product_id, location_id, quantity, unit, expiry_date, purchase_date, notes, created_by)
      values (lot.household_id, lot.product_id, p_to_location, moving, lot.unit, lot.expiry_date, lot.purchase_date, lot.notes, auth.uid())
      returning * into target;
    else
      update public.inventory_lots set quantity = quantity + moving where id = target.id returning * into target;
    end if;
    if moving = lot.quantity then
      delete from public.inventory_lots where id = lot.id;
    else
      update public.inventory_lots set quantity = quantity - moving where id = lot.id;
    end if;
  end if;

  insert into public.inventory_transactions (
    household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
    from_location_id, to_location_id, note, created_by
  ) values (
    lot.household_id, lot.product_id, target.id, prod_name, 'move', moving, lot.unit, target.quantity,
    lot.location_id, p_to_location, nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  );
  return target.id;
end;
$$;

-- Remove a lot entirely, recording what was discarded.
create or replace function public.remove_lot(p_lot_id uuid, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  lot public.inventory_lots%rowtype;
  prod_name text;
begin
  perform public.assert_can_edit(public.lot_household(p_lot_id));
  select * into lot from public.inventory_lots where id = p_lot_id for update;
  if not found then
    raise exception 'lot_not_found' using detail = 'This batch no longer exists.';
  end if;
  select name into prod_name from public.products where id = lot.product_id;
  insert into public.inventory_transactions (
    household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
    from_location_id, note, created_by
  ) values (
    lot.household_id, lot.product_id, null, prod_name, 'discard', -lot.quantity, lot.unit, 0,
    lot.location_id, coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Batch removed'), auth.uid()
  );
  delete from public.inventory_lots where id = lot.id;
end;
$$;

-- Consume an amount of a product across lots, earliest expiry first (FIFO).
create or replace function public.consume_product(
  p_product_id uuid,
  p_quantity numeric,
  p_unit text,
  p_note text default null,
  p_client_mutation_id uuid default null
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  prod public.products%rowtype;
  lot record;
  remaining numeric;
  available numeric;
  take numeric;
  take_in_lot numeric;
  first_txn boolean := true;
begin
  if p_client_mutation_id is not null
     and exists (select 1 from public.inventory_transactions where client_mutation_id = p_client_mutation_id) then
    return 0;
  end if;
  select * into prod from public.products where id = p_product_id;
  if not found then
    raise exception 'not_found' using detail = 'Product not found.';
  end if;
  perform public.assert_can_edit(prod.household_id);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity' using detail = 'Quantity must be greater than zero.';
  end if;

  remaining := public.convert_quantity(p_quantity, p_unit, prod.default_unit);

  select coalesce(sum(public.convert_quantity(l.quantity, l.unit, prod.default_unit)), 0) into available
  from public.inventory_lots l where l.product_id = p_product_id;
  if available < remaining then
    raise exception 'insufficient_quantity' using detail = format('Only %s %s available.', available, prod.default_unit);
  end if;

  for lot in
    select * from public.inventory_lots l
    where l.product_id = p_product_id and l.quantity > 0
    order by l.expiry_date asc nulls last, l.created_at asc
    for update
  loop
    exit when remaining <= 0;
    available := public.convert_quantity(lot.quantity, lot.unit, prod.default_unit);
    take := least(available, remaining);
    take_in_lot := case when take = available then lot.quantity else public.convert_quantity(take, prod.default_unit, lot.unit) end;
    update public.inventory_lots set quantity = greatest(quantity - take_in_lot, 0) where id = lot.id;
    insert into public.inventory_transactions (
      household_id, product_id, lot_id, product_name, kind, quantity_delta, unit, quantity_after,
      from_location_id, note, client_mutation_id, created_by
    ) values (
      prod.household_id, prod.id, lot.id, prod.name, 'consume', -take_in_lot, lot.unit, greatest(lot.quantity - take_in_lot, 0),
      lot.location_id, nullif(btrim(coalesce(p_note, '')), ''),
      case when first_txn then p_client_mutation_id end, auth.uid()
    );
    first_txn := false;
    remaining := remaining - take;
  end loop;

  return public.convert_quantity(p_quantity, p_unit, prod.default_unit);
end;
$$;

-- ---------------------------------------------------------------------------
-- Shopping list: add or merge an item (avoids duplicate open rows per product)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_shopping_item(
  p_list_id uuid,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_product_id uuid default null,
  p_category_id uuid default null,
  p_source public.shopping_source default 'manual',
  p_recipe_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  list public.shopping_lists%rowtype;
  existing public.shopping_list_items%rowtype;
  cat uuid := p_category_id;
begin
  select * into list from public.shopping_lists where id = p_list_id;
  if not found then
    raise exception 'not_found' using detail = 'Shopping list not found.';
  end if;
  perform public.assert_can_edit(list.household_id);
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity' using detail = 'Quantity must be greater than zero.';
  end if;

  if cat is null and p_product_id is not null then
    select category_id into cat from public.products where id = p_product_id;
  end if;

  select * into existing
  from public.shopping_list_items i
  where i.list_id = p_list_id
    and i.removed_at is null and i.purchased_at is null and i.checked_at is null
    and (
      (p_product_id is not null and i.product_id = p_product_id)
      or (p_product_id is null and i.product_id is null and lower(i.name) = lower(btrim(p_name)))
    )
    and public.units_compatible(i.unit, p_unit)
  limit 1
  for update;

  if found then
    update public.shopping_list_items
       set quantity = quantity + public.convert_quantity(p_quantity, p_unit, existing.unit)
     where id = existing.id;
    return existing.id;
  end if;

  insert into public.shopping_list_items (
    household_id, list_id, product_id, category_id, name, quantity, unit, notes, source, recipe_id, created_by
  ) values (
    list.household_id, p_list_id, p_product_id, cat, p_name, p_quantity, p_unit,
    nullif(btrim(coalesce(p_notes, '')), ''), p_source, p_recipe_id, auth.uid()
  )
  returning id into existing.id;
  return existing.id;
end;
$$;

-- Move purchased (checked) items into inventory in one transaction.
-- p_items: [{ "item_id": uuid, "location_id": uuid, "expiry_date": "YYYY-MM-DD"|null, "total_price": number|null }]
create or replace function public.complete_shopping(p_list_id uuid, p_items jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  list public.shopping_lists%rowtype;
  entry jsonb;
  item public.shopping_list_items%rowtype;
  pid uuid;
  unit_code text;
  loc uuid;
  done int := 0;
begin
  select * into list from public.shopping_lists where id = p_list_id;
  if not found then
    raise exception 'not_found' using detail = 'Shopping list not found.';
  end if;
  perform public.assert_can_edit(list.household_id);
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_payload';
  end if;

  for entry in select * from jsonb_array_elements(p_items) loop
    select * into item from public.shopping_list_items
    where id = (entry ->> 'item_id')::uuid and list_id = p_list_id
    for update;
    continue when not found or item.purchased_at is not null or item.removed_at is not null;

    loc := (entry ->> 'location_id')::uuid;
    if loc is null then
      raise exception 'location_required' using detail = format('Choose where "%s" will be stored.', item.name);
    end if;

    pid := item.product_id;
    if pid is null then
      select p.id into pid from public.products p
      where p.household_id = list.household_id and lower(p.name) = lower(item.name) and p.brand_id is null;
    end if;
    if pid is null then
      insert into public.products (household_id, name, category_id, default_unit, created_by)
      values (list.household_id, item.name, item.category_id, item.unit, auth.uid())
      returning id into pid;
    end if;

    select default_unit into unit_code from public.products where id = pid;
    if public.units_compatible(item.unit, unit_code) then
      unit_code := item.unit;
    end if;
    -- If units are incompatible (e.g. list says "2 packs" of a product tracked in grams),
    -- record the purchase in the list's unit only when compatible; otherwise refuse clearly.
    if not public.units_compatible(item.unit, unit_code) then
      raise exception 'incompatible_units'
        using detail = format('"%s" is tracked in %s but the list says %s.', item.name, unit_code, item.unit);
    end if;

    perform public.add_stock(
      pid, loc, item.quantity, unit_code,
      nullif(entry ->> 'expiry_date', '')::date,
      (now() at time zone 'UTC')::date,
      nullif(entry ->> 'total_price', '')::numeric,
      'From shopping list', 'purchase'
    );

    update public.shopping_list_items
       set purchased_at = now(), product_id = pid,
           checked_at = coalesce(checked_at, now()), checked_by = coalesce(checked_by, auth.uid())
     where id = item.id;
    done := done + 1;
  end loop;
  return done;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search (grouped results) and analytics
-- ---------------------------------------------------------------------------
create or replace function public.location_path(p_location uuid)
returns text
language sql
stable
set search_path = ''
as $$
  with recursive chain as (
    select l.id, l.parent_id, l.name, 0 as depth from public.locations l where l.id = p_location
    union all
    select l.id, l.parent_id, l.name, c.depth + 1
    from public.locations l join chain c on l.id = c.parent_id
    where c.depth < 10
  )
  select string_agg(name, ' / ' order by depth desc) from chain;
$$;

create or replace function public.search_household(p_household uuid, p_query text, p_limit int default 6)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  q text := lower(btrim(coalesce(p_query, '')));
  pattern text;
  lim int := least(greatest(coalesce(p_limit, 6), 1), 20);
begin
  if not public.has_household_role(p_household) then
    raise exception 'forbidden';
  end if;
  if char_length(q) = 0 then
    return jsonb_build_object('products', '[]'::jsonb, 'locations', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select ps.id, ps.name, ps.brand_name, ps.category_name, ps.total_quantity, ps.default_unit,
               ps.stock_status, ps.expiry_status, ps.location_names
        from public.product_stock ps
        where ps.household_id = p_household and ps.search_text like pattern
        order by (lower(ps.name) like q || '%') desc, ps.name
        limit lim
      ) r), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select ls.id, ls.name, ls.kind, ls.lot_count, public.location_path(ls.id) as path
        from public.location_stock ls
        where ls.household_id = p_household and lower(ls.name) like pattern
        order by ls.name
        limit lim
      ) r), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select c.id, c.name, c.icon,
               (select count(*) from public.products p where p.category_id = c.id) as product_count
        from public.categories c
        where c.household_id = p_household and lower(c.name) like pattern
        order by c.name
        limit lim
      ) r), '[]'::jsonb)
  );
end;
$$;

create or replace function public.household_analytics(p_household uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  today date;
begin
  if not public.has_household_role(p_household) then
    raise exception 'forbidden';
  end if;
  today := public.household_today(p_household);

  return jsonb_build_object(
    'today', today,
    'totals', (
      select jsonb_build_object(
        'products', count(*),
        'in_stock', count(*) filter (where ps.total_quantity > 0),
        'out', count(*) filter (where ps.stock_status = 'out'),
        'low', count(*) filter (where ps.stock_status = 'low'),
        'needs_restock', count(*) filter (where ps.needs_restock),
        'with_rule', count(*) filter (where ps.min_quantity is not null)
      ) from public.product_stock ps where ps.household_id = p_household),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc, label) from (
        select coalesce(ps.category_name, 'Uncategorized') as label, count(*) as n
        from public.product_stock ps
        where ps.household_id = p_household and ps.total_quantity > 0
        group by 1
      ) s), '[]'::jsonb),
    'by_location', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'value', n) order by n desc, label) from (
        select l.location_id as id, public.location_path(l.location_id) as label, count(distinct l.product_id) as n
        from public.inventory_lots l
        where l.household_id = p_household and l.quantity > 0
        group by l.location_id
      ) s), '[]'::jsonb),
    'expiry_buckets', (
      select jsonb_build_object(
        'expired',   count(*) filter (where l.expiry_date < today),
        'next_3',    count(*) filter (where l.expiry_date between today and today + 3),
        'next_7',    count(*) filter (where l.expiry_date between today + 4 and today + 7),
        'next_30',   count(*) filter (where l.expiry_date between today + 8 and today + 30),
        'later',     count(*) filter (where l.expiry_date > today + 30),
        'no_expiry', count(*) filter (where l.expiry_date is null)
      ) from public.inventory_lots l where l.household_id = p_household and l.quantity > 0),
    'spending', jsonb_build_object(
      'priced_purchases', (
        select count(*) from public.inventory_transactions t
        where t.household_id = p_household and t.total_price is not null),
      'by_month', coalesce((
        select jsonb_agg(jsonb_build_object('month', m, 'value', total) order by m) from (
          select to_char(date_trunc('month', t.created_at), 'YYYY-MM') as m, sum(t.total_price) as total
          from public.inventory_transactions t
          where t.household_id = p_household and t.total_price is not null
            and t.created_at >= date_trunc('month', now()) - interval '5 months'
          group by 1
        ) s), '[]'::jsonb)
    ),
    'activity_30d', coalesce((
      select jsonb_agg(jsonb_build_object('kind', kind, 'value', n) order by n desc) from (
        select t.kind::text as kind, count(*) as n
        from public.inventory_transactions t
        where t.household_id = p_household and t.created_at >= now() - interval '30 days'
        group by 1
      ) s), '[]'::jsonb),
    'top_consumed_30d', coalesce((
      select jsonb_agg(jsonb_build_object('label', product_name, 'value', n) order by n desc) from (
        select t.product_name, count(*) as n
        from public.inventory_transactions t
        where t.household_id = p_household and t.kind = 'consume' and t.created_at >= now() - interval '30 days'
        group by 1
        order by 2 desc
        limit 8
      ) s), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Optional demo data (only runs when a user explicitly asks for it)
-- ---------------------------------------------------------------------------
create or replace function public.seed_sample_data(p_household uuid)
returns int
language plpgsql
set search_path = ''
as $$
declare
  today date;
  n int := 0;
  rec record;
  cat uuid;
  loc uuid;
  pid uuid;
begin
  perform public.assert_can_edit(p_household);
  today := public.household_today(p_household);

  for rec in
    select * from (values
      ('Basmati Rice',      'India Gate',  'Grains & Pasta',    'Pantry',       'kg',    5.0,  2.0,   'rice',          null::int),
      ('Spaghetti',         'Barilla',     'Grains & Pasta',    'Shelf 1',      'g',     500,  250,   'pasta',         240),
      ('Toor Dal',          'Tata Sampann','Pulses & Legumes',  'Shelf 2',      'kg',    1.0,  0.5,   'toor dal',      200),
      ('Whole Wheat Atta',  'Aashirvaad',  'Grains & Pasta',    'Pantry',       'kg',    4.0,  2.0,   'wheat flour',   120),
      ('Toned Milk',        'Amul',        'Dairy & Eggs',      'Refrigerator', 'l',     1.0,  1.0,   'milk',          2),
      ('Eggs',              null,          'Dairy & Eggs',      'Refrigerator', 'pcs',   10,   6,     'egg',           12),
      ('Butter',            'Amul',        'Dairy & Eggs',      'Refrigerator', 'g',     100,  100,   'butter',        25),
      ('Paneer',            null,          'Dairy & Eggs',      'Refrigerator', 'g',     200,  null,  'paneer',        -1),
      ('Tomatoes',          null,          'Produce',           'Refrigerator', 'g',     500,  250,   'tomato',        4),
      ('Onions',            null,          'Produce',           'Pantry',       'kg',    1.5,  1.0,   'onion',         20),
      ('Potatoes',          null,          'Produce',           'Pantry',       'kg',    2.0,  1.0,   'potato',        25),
      ('Garlic',            null,          'Produce',           'Pantry',       'g',     150,  50,    'garlic',        30),
      ('Lemons',            null,          'Produce',           'Refrigerator', 'pcs',   3,    2,     'lemon',         10),
      ('Olive Oil',         'Figaro',      'Oils & Condiments', 'Cabinets',     'ml',    750,  250,   'olive oil',     365),
      ('Sunflower Oil',     'Fortune',     'Oils & Condiments', 'Cabinets',     'l',     0.4,  1.0,   'cooking oil',   180),
      ('Cumin Seeds',       'Everest',     'Spices & Herbs',    'Spice drawer', 'g',     100,  50,    'cumin',         300),
      ('Turmeric Powder',   'Everest',     'Spices & Herbs',    'Spice drawer', 'g',     80,   50,    'turmeric',      300),
      ('Salt',              'Tata',        'Spices & Herbs',    'Spice drawer', 'kg',    1.0,  0.5,   'salt',          null),
      ('Rolled Oats',       'Quaker',      'Grains & Pasta',    'Shelf 1',      'g',     400,  250,   'oats',          150),
      ('Frozen Peas',       'Safal',       'Frozen',            'Freezer',      'g',     500,  null,  'peas',          90),
      ('Bread',             'Modern',      'Bakery',            'Cabinets',     'loaf',  1,    1,     'bread',         -2),
      ('Bananas',           null,          'Produce',           'Pantry',       'pcs',   4,    null,  'banana',        3),
      ('Honey',             'Dabur',       'Oils & Condiments', 'Cabinets',     'g',     250,  null,  'honey',         700),
      ('Dish Soap',         'Vim',         'Household',         'Cabinets',     'ml',    150,  250,   null,            null)
    ) as t(name, brand, category, location, unit, qty, min_qty, ikey, expires_in)
  loop
    if exists (select 1 from public.products p where p.household_id = p_household and lower(p.name) = lower(rec.name)) then
      continue;
    end if;
    select id into cat from public.categories where household_id = p_household and name = rec.category;
    select id into loc from public.locations where household_id = p_household and name = rec.location limit 1;
    if loc is null then
      select id into loc from public.locations where household_id = p_household order by parent_id nulls first, sort_order limit 1;
    end if;
    if loc is null then
      insert into public.locations (household_id, name, kind) values (p_household, 'Kitchen', 'room') returning id into loc;
    end if;
    pid := public.create_item(
      p_household, rec.name, rec.brand, cat, rec.unit, rec.qty, loc,
      case when rec.expires_in is null then null else today + rec.expires_in end,
      today - 3, null, rec.min_qty, null, rec.ikey, null, null
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.assert_can_edit(uuid) from public, anon;
revoke all on function public.lot_household(uuid) from public, anon;
revoke all on function public.create_household(text, text, text, boolean) from public, anon;
revoke all on function public.create_invitation(uuid, text, public.household_role) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.ensure_brand(uuid, text) from public, anon;
revoke all on function public.add_stock(uuid, uuid, numeric, text, date, date, numeric, text, public.txn_kind, uuid) from public, anon;
revoke all on function public.create_item(uuid, text, text, uuid, text, numeric, uuid, date, date, numeric, numeric, numeric, text, text, text) from public, anon;
revoke all on function public.update_product(uuid, int, text, text, uuid, text, numeric, numeric, text, text, text, boolean) from public, anon;
revoke all on function public.adjust_lot(uuid, numeric, public.txn_kind, text, uuid) from public, anon;
revoke all on function public.set_lot_quantity(uuid, numeric, int, text) from public, anon;
revoke all on function public.move_lot(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.remove_lot(uuid, text) from public, anon;
revoke all on function public.consume_product(uuid, numeric, text, text, uuid) from public, anon;
revoke all on function public.upsert_shopping_item(uuid, text, numeric, text, uuid, uuid, public.shopping_source, uuid, text) from public, anon;
revoke all on function public.complete_shopping(uuid, jsonb) from public, anon;
revoke all on function public.location_path(uuid) from public, anon;
revoke all on function public.search_household(uuid, text, int) from public, anon;
revoke all on function public.household_analytics(uuid) from public, anon;
revoke all on function public.seed_sample_data(uuid) from public, anon;
revoke all on function public.household_today(uuid) from public, anon;

grant execute on function public.assert_can_edit(uuid) to authenticated;
grant execute on function public.lot_household(uuid) to authenticated;
grant execute on function public.create_household(text, text, text, boolean) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.household_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.ensure_brand(uuid, text) to authenticated;
grant execute on function public.add_stock(uuid, uuid, numeric, text, date, date, numeric, text, public.txn_kind, uuid) to authenticated;
grant execute on function public.create_item(uuid, text, text, uuid, text, numeric, uuid, date, date, numeric, numeric, numeric, text, text, text) to authenticated;
grant execute on function public.update_product(uuid, int, text, text, uuid, text, numeric, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.adjust_lot(uuid, numeric, public.txn_kind, text, uuid) to authenticated;
grant execute on function public.set_lot_quantity(uuid, numeric, int, text) to authenticated;
grant execute on function public.move_lot(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.remove_lot(uuid, text) to authenticated;
grant execute on function public.consume_product(uuid, numeric, text, text, uuid) to authenticated;
grant execute on function public.upsert_shopping_item(uuid, text, numeric, text, uuid, uuid, public.shopping_source, uuid, text) to authenticated;
grant execute on function public.complete_shopping(uuid, jsonb) to authenticated;
grant execute on function public.location_path(uuid) to authenticated;
grant execute on function public.search_household(uuid, text, int) to authenticated;
grant execute on function public.household_analytics(uuid) to authenticated;
grant execute on function public.seed_sample_data(uuid) to authenticated;
grant execute on function public.household_today(uuid) to authenticated;

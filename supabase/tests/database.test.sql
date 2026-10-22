-- =============================================================================
-- Homebase database tests: RLS isolation, roles, invitations and stock logic.
-- Runs inside a transaction that is rolled back, so it leaves no data behind.
-- Run with:  npm run test:rls   (uses SUPABASE_DB_URL)
-- Any failure raises an exception and aborts the run.
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.com',   '{}'),
  ('00000000-0000-4000-8000-00000000000c', 'carol@example.com', '{}');

do $$ begin
  if (select count(*) from public.profiles where id in (
      '00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000c')) <> 3 then
    raise exception 'TEST FAILED: profiles were not created by the auth trigger';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Alice creates a household and an item
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","email":"alice@example.com","role":"authenticated"}', true);

select set_config('test.hid_a', public.create_household('Alice Home', 'Asia/Kolkata', 'INR', true)::text, true);
select set_config('test.pantry_a', (select id::text from public.locations where household_id = current_setting('test.hid_a')::uuid and name = 'Pantry'), true);
select set_config('test.fridge_a', (select id::text from public.locations where household_id = current_setting('test.hid_a')::uuid and name = 'Refrigerator'), true);
select set_config('test.kitchen_a', (select id::text from public.locations where household_id = current_setting('test.hid_a')::uuid and name = 'Kitchen'), true);
select set_config('test.shelf_a', (select id::text from public.locations where household_id = current_setting('test.hid_a')::uuid and name = 'Shelf 1'), true);

select set_config('test.rice', public.create_item(
  current_setting('test.hid_a')::uuid, 'Basmati Rice', 'India Gate',
  (select id from public.categories where household_id = current_setting('test.hid_a')::uuid and name = 'Grains & Pasta'),
  'kg', 2, current_setting('test.pantry_a')::uuid, current_date + 200, current_date, 450, 1, 3, 'rice', null, null)::text, true);
select set_config('test.rice_lot', (select id::text from public.inventory_lots where product_id = current_setting('test.rice')::uuid), true);

do $$ begin
  if (select count(*) from public.household_members where household_id = current_setting('test.hid_a')::uuid and role = 'owner') <> 1 then
    raise exception 'TEST FAILED: creator should be owner';
  end if;
  if (select count(*) from public.categories where household_id = current_setting('test.hid_a')::uuid) < 10 then
    raise exception 'TEST FAILED: default categories missing';
  end if;
  if (select total_quantity from public.product_stock where id = current_setting('test.rice')::uuid) <> 2 then
    raise exception 'TEST FAILED: product_stock total should be 2';
  end if;
  if (select count(*) from public.inventory_transactions where product_id = current_setting('test.rice')::uuid and kind = 'create') <> 1 then
    raise exception 'TEST FAILED: create transaction missing';
  end if;
end $$;

-- Duplicate product (same name + brand, different case) is rejected
do $$ begin
  begin
    perform public.create_item(current_setting('test.hid_a')::uuid, 'basmati rice', 'india gate', null, 'kg', 1,
      current_setting('test.pantry_a')::uuid);
    raise exception 'TEST FAILED: duplicate product accepted';
  exception when unique_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Stock arithmetic, idempotency, conversions
-- ---------------------------------------------------------------------------
do $$
declare r jsonb;
begin
  r := public.adjust_lot(current_setting('test.rice_lot')::uuid, -0.5, 'consume', 'dinner', '11111111-1111-4111-8111-111111111111');
  if r ->> 'status' <> 'applied' or (r ->> 'quantity')::numeric <> 1.5 then
    raise exception 'TEST FAILED: consume result %', r;
  end if;
  -- Same client mutation id replays => no double application
  r := public.adjust_lot(current_setting('test.rice_lot')::uuid, -0.5, 'consume', 'dinner', '11111111-1111-4111-8111-111111111111');
  if r ->> 'status' <> 'duplicate' then
    raise exception 'TEST FAILED: duplicate mutation not detected %', r;
  end if;
  if (select quantity from public.inventory_lots where id = current_setting('test.rice_lot')::uuid) <> 1.5 then
    raise exception 'TEST FAILED: idempotency broken';
  end if;

  -- Cannot go negative
  begin
    perform public.adjust_lot(current_setting('test.rice_lot')::uuid, -5, 'consume');
    raise exception 'TEST FAILED: negative quantity allowed';
  exception when others then
    if sqlerrm <> 'insufficient_quantity' then raise; end if;
  end;

  -- Sign must match the kind
  begin
    perform public.adjust_lot(current_setting('test.rice_lot')::uuid, 1, 'consume');
    raise exception 'TEST FAILED: positive consume allowed';
  exception when others then
    if sqlerrm <> 'invalid_quantity' then raise; end if;
  end;

  -- Absolute correction records an 'adjust' transaction
  perform public.set_lot_quantity(current_setting('test.rice_lot')::uuid, 1.25, null, 'recount');
  if (select quantity_delta from public.inventory_transactions
      where lot_id = current_setting('test.rice_lot')::uuid and kind = 'adjust') <> -0.25 then
    raise exception 'TEST FAILED: adjust delta wrong';
  end if;

  -- Optimistic concurrency: stale version is rejected
  begin
    perform public.set_lot_quantity(current_setting('test.rice_lot')::uuid, 9, 1, null);
    raise exception 'TEST FAILED: stale version accepted';
  exception when others then
    if sqlerrm <> 'version_conflict' then raise; end if;
  end;

  -- add_stock in grams merges into the kg lot with same location/expiry
  perform public.add_stock(current_setting('test.rice')::uuid, current_setting('test.pantry_a')::uuid, 750, 'g',
    (select expiry_date from public.inventory_lots where id = current_setting('test.rice_lot')::uuid));
  if (select quantity from public.inventory_lots where id = current_setting('test.rice_lot')::uuid) <> 2 then
    raise exception 'TEST FAILED: g -> kg merge expected 2 kg, got %',
      (select quantity from public.inventory_lots where id = current_setting('test.rice_lot')::uuid);
  end if;

  -- Incompatible units are rejected (volume into a mass product)
  begin
    perform public.add_stock(current_setting('test.rice')::uuid, current_setting('test.pantry_a')::uuid, 1, 'l');
    raise exception 'TEST FAILED: incompatible unit accepted';
  exception when others then
    if sqlerrm <> 'incompatible_units' then raise; end if;
  end;
end $$;

-- Low-stock rule: min 1 kg; drop to 0.5 => needs_restock
do $$ begin
  perform public.set_lot_quantity(current_setting('test.rice_lot')::uuid, 0.5);
  if not (select needs_restock from public.product_stock where id = current_setting('test.rice')::uuid) then
    raise exception 'TEST FAILED: needs_restock should be true';
  end if;
  if (select stock_status from public.product_stock where id = current_setting('test.rice')::uuid) <> 'low' then
    raise exception 'TEST FAILED: stock_status should be low';
  end if;
  perform public.set_lot_quantity(current_setting('test.rice_lot')::uuid, 2);
end $$;

-- Moving part of a lot splits it; FIFO consumption uses earliest expiry first
do $$
declare moved uuid;
begin
  moved := public.move_lot(current_setting('test.rice_lot')::uuid, current_setting('test.shelf_a')::uuid, 0.5);
  if moved = current_setting('test.rice_lot')::uuid then
    raise exception 'TEST FAILED: partial move should create a new lot';
  end if;
  if (select quantity from public.inventory_lots where id = current_setting('test.rice_lot')::uuid) <> 1.5
     or (select quantity from public.inventory_lots where id = moved) <> 0.5 then
    raise exception 'TEST FAILED: partial move quantities wrong';
  end if;
  -- Second lot that expires sooner
  perform public.add_stock(current_setting('test.rice')::uuid, current_setting('test.fridge_a')::uuid, 1, 'kg', current_date + 2);
  perform public.consume_product(current_setting('test.rice')::uuid, 1200, 'g');
  if exists (select 1 from public.inventory_lots
             where product_id = current_setting('test.rice')::uuid and expiry_date = current_date + 2 and quantity <> 0) then
    raise exception 'TEST FAILED: FIFO should empty the soonest-expiring lot first';
  end if;
  if (select total_quantity from public.product_stock where id = current_setting('test.rice')::uuid) <> 1.8 then
    raise exception 'TEST FAILED: total after FIFO consume should be 1.8, got %',
      (select total_quantity from public.product_stock where id = current_setting('test.rice')::uuid);
  end if;
end $$;

-- Location hierarchy: cycles are rejected
do $$ begin
  begin
    update public.locations set parent_id = current_setting('test.shelf_a')::uuid
     where id = current_setting('test.kitchen_a')::uuid;
    raise exception 'TEST FAILED: location cycle accepted';
  exception when others then
    if sqlerrm <> 'location_cycle' then raise; end if;
  end;
  begin
    update public.locations set parent_id = id where id = current_setting('test.pantry_a')::uuid;
    raise exception 'TEST FAILED: self-parent accepted';
  exception when others then
    if sqlerrm not in ('location_cycle') and sqlstate <> '23514' then raise; end if;
  end;
end $$;

-- Transactions are append-only for app users
do $$ begin
  begin
    update public.inventory_transactions set note = 'tampered' where household_id = current_setting('test.hid_a')::uuid;
    raise exception 'TEST FAILED: transaction update allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Shopping: merge duplicates, then complete purchase into inventory
do $$
declare
  list uuid;
  i1 uuid;
  i2 uuid;
  milk uuid;
begin
  select id into list from public.shopping_lists where household_id = current_setting('test.hid_a')::uuid;
  i1 := public.upsert_shopping_item(list, 'Basmati Rice', 1, 'kg', current_setting('test.rice')::uuid);
  i2 := public.upsert_shopping_item(list, 'Basmati Rice', 500, 'g', current_setting('test.rice')::uuid);
  if i1 <> i2 or (select quantity from public.shopping_list_items where id = i1) <> 1.5 then
    raise exception 'TEST FAILED: shopping merge wrong';
  end if;
  milk := public.upsert_shopping_item(list, 'Oat Milk', 2, 'l');
  update public.shopping_list_items set checked_at = now() where id in (i1, milk);
  if public.complete_shopping(list, jsonb_build_array(
       jsonb_build_object('item_id', i1, 'location_id', current_setting('test.pantry_a'), 'total_price', 300),
       jsonb_build_object('item_id', milk, 'location_id', current_setting('test.fridge_a'), 'expiry_date', (current_date + 5)::text)
     )) <> 2 then
    raise exception 'TEST FAILED: complete_shopping count';
  end if;
  if (select total_quantity from public.product_stock where id = current_setting('test.rice')::uuid) <> 3.3 then
    raise exception 'TEST FAILED: rice after purchase should be 3.3';
  end if;
  if not exists (select 1 from public.products where household_id = current_setting('test.hid_a')::uuid and name = 'Oat Milk') then
    raise exception 'TEST FAILED: purchase should create unknown products';
  end if;
  if (select count(*) from public.shopping_list_items where list_id = list and purchased_at is null) <> 0 then
    raise exception 'TEST FAILED: purchased items should be closed';
  end if;
  if (select (public.household_analytics(current_setting('test.hid_a')::uuid) -> 'spending' ->> 'priced_purchases')::int) < 2 then
    raise exception 'TEST FAILED: analytics spending count';
  end if;
end $$;

-- Invite Carol as a viewer
select set_config('test.invite_token', public.create_invitation(current_setting('test.hid_a')::uuid, 'Carol@Example.com', 'viewer'), true);

-- The last owner cannot leave
do $$ begin
  begin
    delete from public.household_members
     where household_id = current_setting('test.hid_a')::uuid and user_id = auth.uid();
    raise exception 'TEST FAILED: last owner removed';
  exception when others then
    if sqlerrm <> 'last_owner' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Bob: a different household must see and change nothing of Alice's
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","email":"bob@example.com","role":"authenticated"}', true);
select set_config('test.hid_b', public.create_household('Bob Flat', 'UTC', 'USD', false)::text, true);

do $$
declare n int;
begin
  if exists (select 1 from public.households where id = current_setting('test.hid_a')::uuid) then
    raise exception 'TEST FAILED: Bob can see Alice household';
  end if;
  if exists (select 1 from public.products where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.product_stock where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.lot_details where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.inventory_transactions where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.locations where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.shopping_list_items where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.household_invitations where household_id = current_setting('test.hid_a')::uuid)
     or exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000a') then
    raise exception 'TEST FAILED: Bob can read Alice data';
  end if;

  update public.products set name = 'hacked' where household_id = current_setting('test.hid_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: Bob updated Alice products'; end if;

  delete from public.inventory_lots where household_id = current_setting('test.hid_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: Bob deleted Alice lots'; end if;

  begin
    insert into public.categories (household_id, name) values (current_setting('test.hid_a')::uuid, 'Injected');
    raise exception 'TEST FAILED: Bob inserted into Alice household';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.adjust_lot(current_setting('test.rice_lot')::uuid, -0.1, 'consume');
    raise exception 'TEST FAILED: Bob adjusted Alice lot';
  exception when others then
    if sqlerrm <> 'lot_not_found' then raise; end if;
  end;

  begin
    perform public.create_item(current_setting('test.hid_a')::uuid, 'Trojan', null, null, 'pcs', 1, current_setting('test.pantry_a')::uuid);
    raise exception 'TEST FAILED: Bob created item in Alice household';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  begin
    perform public.search_household(current_setting('test.hid_a')::uuid, 'rice');
    raise exception 'TEST FAILED: Bob searched Alice household';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  begin
    perform public.household_analytics(current_setting('test.hid_a')::uuid);
    raise exception 'TEST FAILED: Bob read Alice analytics';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  -- Bob cannot reference Alice's location from his own household
  begin
    insert into public.locations (household_id, parent_id, name)
    values (current_setting('test.hid_b')::uuid, current_setting('test.pantry_a')::uuid, 'Sneaky');
    raise exception 'TEST FAILED: cross-household parent accepted';
  exception when others then
    if sqlerrm <> 'invalid_parent' then raise; end if;
  end;

  -- Bob cannot add himself to Alice's household
  begin
    insert into public.household_members (household_id, user_id, role)
    values (current_setting('test.hid_a')::uuid, auth.uid(), 'owner');
    raise exception 'TEST FAILED: self-join accepted';
  exception when insufficient_privilege then null;
  end;

  -- Bob cannot use Carol's invitation
  begin
    perform public.accept_invitation(current_setting('test.invite_token'));
    raise exception 'TEST FAILED: invitation accepted by wrong email';
  exception when others then
    if sqlerrm <> 'invitation_email_mismatch' then raise; end if;
  end;

  -- The recipe catalog is shared reference data
  if (select count(*) from public.recipes where household_id is null) < 15 then
    raise exception 'TEST FAILED: Bob should see the recipe catalog';
  end if;
end $$;

-- Bob loads optional sample data, searches it, then deletes his household
do $$
declare res jsonb;
begin
  if public.seed_sample_data(current_setting('test.hid_b')::uuid) < 20 then
    raise exception 'TEST FAILED: sample data not created';
  end if;
  if public.seed_sample_data(current_setting('test.hid_b')::uuid) <> 0 then
    raise exception 'TEST FAILED: sample data should not duplicate';
  end if;
  if (select count(*) from public.product_stock where household_id = current_setting('test.hid_b')::uuid and expiry_status = 'expired') < 1 then
    raise exception 'TEST FAILED: expected expired sample items';
  end if;
  if (select count(*) from public.product_stock where household_id = current_setting('test.hid_b')::uuid and expiry_status = 'none'
        and earliest_expiry is not null) <> 0 then
    raise exception 'TEST FAILED: expiry status inconsistent';
  end if;
  res := public.search_household(current_setting('test.hid_b')::uuid, 'rice');
  if jsonb_array_length(res -> 'products') < 1 then
    raise exception 'TEST FAILED: search found nothing: %', res;
  end if;
  res := public.search_household(current_setting('test.hid_b')::uuid, '100%_');
  if jsonb_array_length(res -> 'products') <> 0 then
    raise exception 'TEST FAILED: LIKE wildcards should be escaped';
  end if;
  delete from public.households where id = current_setting('test.hid_b')::uuid;
  if exists (select 1 from public.products where household_id = current_setting('test.hid_b')::uuid) then
    raise exception 'TEST FAILED: household delete did not cascade';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Carol accepts the invitation as a viewer: read-only access
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","email":"carol@example.com","role":"authenticated"}', true);

do $$
declare n int;
begin
  if public.accept_invitation(current_setting('test.invite_token')) <> current_setting('test.hid_a')::uuid then
    raise exception 'TEST FAILED: accept_invitation returned wrong household';
  end if;
  begin
    perform public.accept_invitation(current_setting('test.invite_token'));
    raise exception 'TEST FAILED: invitation reused';
  exception when others then
    if sqlerrm <> 'invitation_used' then raise; end if;
  end;

  if not exists (select 1 from public.product_stock where id = current_setting('test.rice')::uuid) then
    raise exception 'TEST FAILED: viewer cannot read inventory';
  end if;
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-00000000000a') then
    raise exception 'TEST FAILED: co-member profile should be visible';
  end if;

  update public.products set name = 'viewer edit' where id = current_setting('test.rice')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAILED: viewer updated a product'; end if;

  begin
    perform public.adjust_lot(current_setting('test.rice_lot')::uuid, -0.1, 'consume');
    raise exception 'TEST FAILED: viewer adjusted stock';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  -- Viewers may still rate products (personal opinion), but only as themselves
  insert into public.product_ratings (household_id, product_id, user_id, rating, notes)
  values (current_setting('test.hid_a')::uuid, current_setting('test.rice')::uuid, auth.uid(), 4, 'Fluffy');
  begin
    insert into public.product_ratings (household_id, product_id, user_id, rating)
    values (current_setting('test.hid_a')::uuid, current_setting('test.rice')::uuid, '00000000-0000-4000-8000-00000000000a', 1);
    raise exception 'TEST FAILED: rating as another user accepted';
  exception when insufficient_privilege then null;
  end;

  -- Viewers can leave
  delete from public.household_members where household_id = current_setting('test.hid_a')::uuid and user_id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FAILED: viewer could not leave'; end if;
  if exists (select 1 from public.products where household_id = current_setting('test.hid_a')::uuid) then
    raise exception 'TEST FAILED: data visible after leaving';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous users see nothing
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  begin
    perform 1 from public.products limit 1;
    raise exception 'TEST FAILED: anon can query products';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_household('anon');
    raise exception 'TEST FAILED: anon can create household';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL DATABASE TESTS PASSED' as result;
rollback;

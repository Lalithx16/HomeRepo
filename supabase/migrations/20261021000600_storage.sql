-- Private bucket for optional item photos. Objects are stored as
-- "<household_id>/<random>.<ext>" and access is limited to household members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function public.try_uuid(text) to authenticated;

create policy "item images: members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and public.has_household_role(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "item images: editors upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and public.can_edit_household(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "item images: editors update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'item-images'
    and public.can_edit_household(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "item images: editors delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and public.can_edit_household(public.try_uuid((storage.foldername(name))[1]))
  );

-- Harden function execution privileges.
-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- The storage migration created try_uuid() after the earlier blanket revoke,
-- so explicitly remove anonymous/public execution while retaining the policy
-- helper access needed by authenticated users.
revoke execute on function public.try_uuid(text) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;

-- Keep future functions created by the standard Supabase migration role from
-- inheriting PUBLIC EXECUTE by default. Existing functions keep their explicit
-- grants/revokes from their own migrations.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

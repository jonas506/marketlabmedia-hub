create or replace function public.is_internal(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

grant execute on function public.is_internal(uuid) to authenticated, anon, service_role;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and coalesce(qual,'true') = 'true'
      and tablename not like 'course_%'
  loop
    execute format('alter policy %I on %I.%I using (public.is_internal(auth.uid()))', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
alter table if exists public.business_config enable row level security;

drop policy if exists "business_config_select_authenticated" on public.business_config;
create policy "business_config_select_authenticated"
  on public.business_config
  for select
  to authenticated
  using (true);

drop policy if exists "business_config_insert_admin" on public.business_config;
create policy "business_config_insert_admin"
  on public.business_config
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and upper(p.role) = 'ADMIN'
    )
  );

drop policy if exists "business_config_update_admin" on public.business_config;
create policy "business_config_update_admin"
  on public.business_config
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and upper(p.role) = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and upper(p.role) = 'ADMIN'
    )
  );

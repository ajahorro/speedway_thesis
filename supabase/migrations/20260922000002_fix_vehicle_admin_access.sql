alter table if exists public.vehicles enable row level security;

drop policy if exists "Vehicles owners can read own vehicles" on public.vehicles;
create policy "Vehicles owners can read own vehicles"
  on public.vehicles
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Admins can read all vehicles" on public.vehicles;
create policy "Admins can read all vehicles"
  on public.vehicles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and upper(p.role) = 'ADMIN'
    )
  );

drop policy if exists "Owners manage own vehicles" on public.vehicles;
create policy "Owners manage own vehicles"
  on public.vehicles
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Admins manage customer vehicles" on public.vehicles;
create policy "Admins manage customer vehicles"
  on public.vehicles
  for all
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

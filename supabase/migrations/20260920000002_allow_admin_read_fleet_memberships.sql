-- Admin booking creation must be able to expand a customer's fleet into vehicles.
drop policy if exists "Admins read fleet memberships" on public.fleet_group_vehicles;
create policy "Admins read fleet memberships"
  on public.fleet_group_vehicles for select
  using (exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and upper(p.role) = 'ADMIN'
  ));
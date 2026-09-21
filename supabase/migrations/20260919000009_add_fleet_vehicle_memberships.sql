-- Vehicles may belong to many fleets, like songs in multiple playlists.
create table if not exists public.fleet_group_vehicles (
  fleet_group_id uuid not null references public.fleet_groups(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fleet_group_id, vehicle_id)
);

-- Preserve memberships created under the former single-fleet column.
insert into public.fleet_group_vehicles (fleet_group_id, vehicle_id)
select fleet_group_id, id
from public.vehicles
where fleet_group_id is not null
on conflict do nothing;

alter table public.fleet_group_vehicles enable row level security;

drop policy if exists "owners manage fleet memberships" on public.fleet_group_vehicles;
create policy "owners manage fleet memberships"
  on public.fleet_group_vehicles for all
  using (
    exists (
      select 1 from public.fleet_groups fg
      where fg.id = fleet_group_id and fg.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.fleet_groups fg
      where fg.id = fleet_group_id and fg.owner_id = auth.uid()
    )
  );

create index if not exists fleet_group_vehicles_vehicle_idx
  on public.fleet_group_vehicles(vehicle_id);

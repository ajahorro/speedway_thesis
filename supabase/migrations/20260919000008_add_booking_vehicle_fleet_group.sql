alter table public.booking_vehicles
  add column if not exists fleet_group_id uuid references public.fleet_groups(id) on delete set null;

create index if not exists booking_vehicles_fleet_group_idx
  on public.booking_vehicles(fleet_group_id);
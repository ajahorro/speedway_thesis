-- Fleet groups allow one customer booking to contain mixed vehicle categories.
create table if not exists public.fleet_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.vehicles
  add column if not exists fleet_group_id uuid references public.fleet_groups(id) on delete set null;

alter table public.fleet_groups enable row level security;

drop policy if exists "Customers manage own fleet groups" on public.fleet_groups;
create policy "Customers manage own fleet groups"
  on public.fleet_groups for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Admins read fleet groups" on public.fleet_groups;
create policy "Admins read fleet groups"
  on public.fleet_groups for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and upper(p.role) = 'ADMIN'));

create index if not exists fleet_groups_owner_idx on public.fleet_groups(owner_id);
create index if not exists vehicles_fleet_group_idx on public.vehicles(fleet_group_id);

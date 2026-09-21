alter table if exists public.business_config
  add column if not exists max_vehicles_per_staff integer default 4,
  add column if not exists promo_rules jsonb default '[]'::jsonb,
  add column if not exists custom_services jsonb default '[]'::jsonb;

update public.business_config
set max_vehicles_per_staff = 4
where max_vehicles_per_staff is null;

update public.business_config
set promo_rules = '[]'::jsonb
where promo_rules is null;

update public.business_config
set custom_services = '[]'::jsonb
where custom_services is null;

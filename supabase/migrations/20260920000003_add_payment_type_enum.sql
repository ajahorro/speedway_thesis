do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_type_enum') then
    create type public.payment_type_enum as enum ('Full', 'Downpayment', 'Manual');
  end if;
end;
$$;

alter table public.payments
  add column if not exists payment_type public.payment_type_enum;

update public.payments
set payment_type = case
  when lower(coalesce((regexp_match(notes, '(?:TYPE|PAYMENT_TYPE):([^|]+)'))[1], '')) = 'downpayment'
    then 'Downpayment'::public.payment_type_enum
  when lower(coalesce((regexp_match(notes, '(?:TYPE|PAYMENT_TYPE):([^|]+)'))[1], '')) = 'full'
    then 'Full'::public.payment_type_enum
  else 'Manual'::public.payment_type_enum
end
where payment_type is null;

alter table public.payments
  alter column payment_type set default 'Manual'::public.payment_type_enum,
  alter column payment_type set not null;
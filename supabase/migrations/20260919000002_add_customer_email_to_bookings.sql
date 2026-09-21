alter table public.bookings
  add column if not exists customer_email text;

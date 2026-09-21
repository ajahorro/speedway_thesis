alter table public.booking_messages
  add column if not exists message_text text;

update public.booking_messages
set message_text = message
where message_text is null;

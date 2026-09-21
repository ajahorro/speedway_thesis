create or replace function public.ensure_notification_message()
returns trigger
language plpgsql
as $$
begin
  if new.message is null or btrim(new.message) = '' then
    new.message := coalesce(nullif(btrim(new.title), ''), 'New notification');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_notification_message on public.notifications;

create trigger trg_ensure_notification_message
before insert on public.notifications
for each row
execute function public.ensure_notification_message();

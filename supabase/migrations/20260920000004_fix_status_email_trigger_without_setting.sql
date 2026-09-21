-- Status changes must remain writable even when the optional email secret is not configured.
create or replace function public.handle_booking_status_change()
returns trigger as $$
declare
  project_url text := 'https://nsmytxlaidmndtqxctrw.supabase.co';
  service_key text := current_setting('app.supabase_service_role_key', true);
begin
  if (old.status is distinct from new.status)
     and service_key is not null
     and service_key <> '' then
    perform
      net.http_post(
        url := project_url || '/functions/v1/send-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'bookingId', new.id,
          'newStatus', new.status
        )
      );
  end if;

  return new;
end;
$$ language plpgsql security definer;
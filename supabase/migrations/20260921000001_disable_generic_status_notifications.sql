-- Suppress generic booking status notifications that do not carry a meaningful booking-specific status update.
-- This keeps the system from creating vague 'booking updated' notifications for every status churn.

create or replace function public.handle_booking_status_change()
returns trigger as $$
declare
  project_url text := 'https://nsmytxlaidmndtqxctrw.supabase.co';
  service_key text := current_setting('app.supabase_service_role_key', true);
  normalized_status text;
begin
  normalized_status := lower(coalesce(new.status, ''));

  -- Only dispatch meaningful booking lifecycle updates. Ignore generic or unscoped churn.
  if old.status is distinct from new.status
     and service_key is not null
     and service_key <> ''
     and normalized_status in ('confirmed', 'in_progress', 'completed', 'cancelled', 'released', 'flagged_noshow', 'scheduled') then
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

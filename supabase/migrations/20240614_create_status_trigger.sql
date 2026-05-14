-- 🛡️ REQ-SYS-02: Automated Status Notification Trigger
-- This trigger automatically dispatches an email via the Supabase Edge Function
-- whenever a booking status changes (e.g., Confirmed -> Ongoing -> Completed).

-- 1. Enable the pg_net extension if not already present
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the notification trigger function
CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  project_url TEXT := 'https://nsmytxlaidmndtqxctrw.supabase.co';
  -- We use the service_role key to bypass function security
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXl0eGxhaWRtbmR0cXhjdHJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2MzI5NCwiZXhwIjoyMDkzODM5Mjk0fQ.gphFl_XiXHqBOAFFU9ruNedL8qT1-u5G9LfipFZBNVM'; 
BEGIN
  -- Only trigger if the status has actually changed
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM
      net.http_post(
        url := project_url || '/functions/v1/send-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'bookingId', NEW.id,
          'newStatus', NEW.status
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to the bookings table
DROP TRIGGER IF EXISTS on_booking_status_change ON public.bookings;
CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_change();

COMMENT ON TRIGGER on_booking_status_change ON public.bookings IS 'Automated email notification trigger for status changes.';

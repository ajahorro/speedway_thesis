-- 🛡️ REQ-SYS-02: Automated Status Sync & Notification System
-- This migration implements:
-- 1. Unit -> Master Status Propagation (Transactional Integrity)
-- 2. Master -> Email Notification (Automated Dispatch)

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── MASTER STATUS PROPAGATOR ───────────────────────────────────────
-- This ensures the parent booking reacts to individual vehicle updates.

CREATE OR REPLACE FUNCTION public.sync_booking_master_status()
RETURNS trigger AS $$
DECLARE
    v_booking_id UUID;
    v_any_in_progress BOOLEAN;
    v_all_completed BOOLEAN;
    v_current_status TEXT;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    -- Get current master status (normalized to lowercase)
    SELECT LOWER(status) INTO v_current_status FROM public.bookings WHERE id = v_booking_id;

    -- 🔍 Check if any unit is IN_PROGRESS (case-insensitive)
    SELECT EXISTS (
        SELECT 1 FROM public.booking_vehicles 
        WHERE booking_id = v_booking_id AND UPPER(status) = 'IN_PROGRESS'
    ) INTO v_any_in_progress;

    -- 🔍 Check if all units are COMPLETED
    SELECT NOT EXISTS (
        SELECT 1 FROM public.booking_vehicles 
        WHERE booking_id = v_booking_id AND UPPER(status) != 'COMPLETED' AND UPPER(status) != 'CANCELLED'
    ) INTO v_all_completed;

    -- 🚀 PROPAGATION LOGIC
    -- If any unit starts, the whole session is 'in_progress'
    IF v_any_in_progress AND v_current_status NOT IN ('in_progress', 'completed', 'cancelled') THEN
        UPDATE public.bookings SET status = 'in_progress' WHERE id = v_booking_id;
    
    -- If all units finish, the whole session is 'completed'
    ELSIF v_all_completed AND v_current_status != 'completed' AND v_current_status != 'cancelled' THEN
        UPDATE public.bookings SET status = 'completed' WHERE id = v_booking_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach propagator to vehicle updates
DROP TRIGGER IF EXISTS trg_sync_booking_status ON public.booking_vehicles;
CREATE TRIGGER trg_sync_booking_status
AFTER UPDATE OF status ON public.booking_vehicles
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_master_status();


-- ─── EMAIL NOTIFICATION DISPATCHER ──────────────────────────────────
-- This fires whenever the master booking status moves to a significant milestone.

CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  project_url TEXT := 'https://nsmytxlaidmndtqxctrw.supabase.co';
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXl0eGxhaWRtbmR0cXhjdHJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2MzI5NCwiZXhwIjoyMDkzODM5Mjk0fQ.gphFl_XiXHqBOAFFU9ruNedL8qT1-u5G9LfipFZBNVM'; 
BEGIN
  -- Only trigger if the status has actually changed (case-insensitive)
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

-- Attach dispatcher to booking status updates
DROP TRIGGER IF EXISTS on_booking_status_change ON public.bookings;
CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_change();

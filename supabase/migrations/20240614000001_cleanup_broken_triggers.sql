-- 🧹 CLEANUP: Removing broken triggers that depend on pg_net
-- These triggers are causing "relation net.http_headers does not exist" errors
-- and blocking all status updates.

DROP TRIGGER IF EXISTS on_booking_status_change ON public.bookings;
DROP TRIGGER IF EXISTS trg_sync_booking_status ON public.booking_vehicles;
DROP FUNCTION IF EXISTS public.handle_booking_status_change();
DROP FUNCTION IF EXISTS public.sync_booking_master_status();

-- 🛡️ Note: Status propagation is now handled by the Backend Controller 
-- and Frontend Fallback for maximum reliability.

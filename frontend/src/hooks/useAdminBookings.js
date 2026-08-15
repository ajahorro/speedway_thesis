import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { calculatePaymentStatus } from '../utils/paymentUtils';
import toast from 'react-hot-toast';

/**
 * useAdminBookings — REQ-NFR-05
 * Custom hook for admin booking data with Supabase Realtime.
 * Replaces inline fetch + useEffect in AdminBookings.jsx.
 * Returns: { bookings, loading, refresh }
 */
export const useAdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      logger.admin('Syncing Live Booking Directory...');
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email),
          vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*),
          payments:payments!payments_booking_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // DEDUPLICATION ENGINE: Resolve Cartesian Product from nested joins
      const uniqueMap = new Map();
      (data || []).forEach(b => {
        if (!uniqueMap.has(b.id)) {
          uniqueMap.set(b.id, {
            ...b,
            calculatedPaymentStatus: calculatePaymentStatus(b)
          });
        }
      });

      setBookings(Array.from(uniqueMap.values()));
      logger.admin('Booking Directory synchronized.');
    } catch (err) {
      logger.error('Booking Fetch Error', err);
      toast.error('Failed to sync booking records.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced refresh — prevents rapid-fire re-fetches from multiple real-time events
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refresh();
    }, 300);
  }, [refresh]);

  useEffect(() => {
    refresh();

    // Multi-table Supabase Realtime subscription
    const channel = supabase
      .channel('admin-bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_vehicles' }, debouncedRefresh)
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [refresh, debouncedRefresh]);

  return { bookings, loading, refresh };
};

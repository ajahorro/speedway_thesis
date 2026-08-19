import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCustomerBookings } from '../services/bookingService';

/**
 * useBookings hook — PRODUCTION GRADE
 * Real-time subscription with debounce stabilization.
 * Returns: { bookings, activeBooking, upcomingBookings, pastBookings, loading, refresh }
 */
export const useBookings = (customerId) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await fetchCustomerBookings(customerId);

      // Enrich each booking with computed payment status
      const enriched = data.map(b => {
        const payments = b.payments || [];
        const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
        const isPendingVerification = payments.some(p => p.status === 'FOR_VERIFICATION');

        let paymentStatus = 'UNPAID';
        if (totalPaid >= b.total_amount && b.total_amount > 0) {
          paymentStatus = 'PAID';
        } else if (isPendingVerification) {
          paymentStatus = 'VERIFYING';
        } else if (totalPaid >= (b.total_amount * 0.3) && b.total_amount > 0) {
          paymentStatus = 'DOWNPAYMENT_PAID';
        }

        return { ...b, paymentStatus, totalPaid };
      });

      setBookings(enriched);
    } catch (err) {
      console.error('useBookings fetch error details:', {
        message: err?.message || err,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err
      });
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Debounced refresh — prevents rapid-fire re-fetches from multiple real-time events
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refresh();
    }, 300); // 300ms debounce window
  }, [refresh]);

  useEffect(() => {
    refresh();

    if (!customerId) return;

    // Unified multi-table subscription
    const channel = supabase
      .channel(`customer-bookings-unified-${customerId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `customer_id=eq.${customerId}`
      }, debouncedRefresh)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payments'
      }, debouncedRefresh)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'booking_vehicles'
      }, debouncedRefresh)
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [refresh, debouncedRefresh, customerId]);

  // Derived data — unified state mapping
  const activeBooking = bookings.find(b => ['in_progress'].includes(b.status?.toLowerCase())) || bookings.find(b => b.status?.toLowerCase() === 'scheduled');
  const upcomingBookings = bookings.filter(b => ['scheduled', 'confirmed'].includes(b.status?.toLowerCase()));
  const pastBookings = bookings.filter(b => ['completed', 'cancelled'].includes(b.status?.toLowerCase()));

  return { bookings, allBookings: bookings, activeBooking, upcomingBookings, pastBookings, loading, refresh };
};

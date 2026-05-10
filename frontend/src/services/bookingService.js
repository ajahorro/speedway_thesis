import { supabase } from '../lib/supabase';
import { emitEvent, EVENTS } from './eventEngine';

/**
 * bookingService.js
 * Centralized booking logic for the Customer portal.
 * Handles creation, fetching, and real-time subscription for bookings.
 */

/**
 * Create a new booking with vehicles and services.
 * Mirrors the schema used by AdminBookings:
 *   bookings -> booking_vehicles -> booking_vehicle_services
 */
export const createBooking = async (customerId, bookingData) => {
  const vehicles = bookingData.vehicles || [];
  const totalAmount = vehicles.reduce((total, v) => {
    return total + (v.services || []).reduce((sub, s) => sub + s.price, 0);
  }, 0);

  // 1. Insert the master booking record
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      customer_name: bookingData.customerName, // Added this field
      start_datetime: combineDateAndTime(bookingData.date, bookingData.time),
      end_datetime: calculateEstimatedEnd(bookingData.date, bookingData.time), // Satisfy NOT NULL constraint
      status: 'scheduled',
      total_amount: totalAmount,
      notes: bookingData.notes || '',
      contact_number: bookingData.contactNumber
    })
    .select()
    .single();
  
  if (bookingError) {
    console.error('Master Booking Insert Error:', bookingError);
    throw new Error(`Master Booking Error: ${bookingError.message}`);
  }

  const bookingRef = booking.id.substring(0, 8).toUpperCase();

  // 2. Insert vehicle(s) into booking_vehicles
  for (const vehicle of vehicles) {
    const { data: bv, error: bvError } = await supabase
      .from('booking_vehicles')
      .insert({
        booking_id: booking.id,
        vehicle_type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        plate_number: vehicle.plateNumber
      })
      .select()
      .single();

    if (bvError) {
      console.error('Vehicle Insert Error:', bvError);
      throw new Error(`Vehicle Error: ${bvError.message}`);
    }

    // 3. Insert selected services for that vehicle
    const services = vehicle.services || [];
    if (services.length > 0) {
      const serviceRows = services.map(s => ({
        booking_vehicle_id: bv.id,
        service_name: s.name,
        price: s.price
      }));

      const { error: svcError } = await supabase
        .from('booking_vehicle_services')
        .insert(serviceRows);

      if (svcError) {
        console.error('Service Insert Error:', svcError);
        throw new Error(`Service Error: ${svcError.message}`);
      }
    }
  }

  // 4. If GCash, insert a payment record with FOR_VERIFICATION status
  if (bookingData.payment.method === 'GCash' && bookingData.payment.proofOfPayment) {
    try {
      const file = bookingData.payment.proofOfPayment;
      const fileExt = file.name.split('.').pop();
      const filePath = `receipts/${booking.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('payment-receipts').getPublicUrl(filePath);

      const paymentAmount = bookingData.payment.type === 'Full' ? totalAmount : Math.ceil(totalAmount * 0.3);

      const { error: payError } = await supabase.from('payments').insert({
        booking_id: booking.id,
        amount: paymentAmount,
        method: 'GCash',
        status: 'FOR_VERIFICATION',
        receipt_url: publicUrl,
        reference_number: `GC-${bookingRef}` // Simplified ref
      });

      if (payError) throw payError;

      // EVENT: Payment Submitted
      await emitEvent(EVENTS.PAYMENT_SUBMITTED, {
        userId: customerId,
        bookingId: booking.id,
        meta: { bookingRef, amount: paymentAmount }
      });
    } catch (payEx) {
      console.error('Payment Processing Error:', payEx);
      // We don't throw here to avoid failing the whole booking if just the payment metadata fails, 
      // but in a production app we might want to handle this more strictly.
    }
  }

  // EVENT: Booking Created
  await emitEvent(EVENTS.BOOKING_CREATED, {
    userId: customerId,
    bookingId: booking.id,
    meta: { bookingRef }
  });

  return booking;
};

/**
 * Fetch all bookings for a specific customer, with vehicles and payments.
 */
export const fetchCustomerBookings = async (customerId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles:booking_vehicles(*, services:booking_vehicle_services(*)),
      payments:payments(*)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetch a single booking by ID for the customer detail view.
 */
export const fetchBookingById = async (bookingId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      vehicles:booking_vehicles(*, services:booking_vehicle_services(*)),
      payments:payments(*),
      assigned_staff:profiles!bookings_staff_id_fkey(first_name, last_name, email)
    `)
    .eq('id', bookingId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Subscribe to real-time changes on a specific booking.
 * Returns the channel so the caller can unsubscribe.
 */
export const subscribeToBooking = (bookingId, callback) => {
  const channel = supabase
    .channel(`booking-${bookingId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: `id=eq.${bookingId}`
    }, callback)
    .subscribe();

  return channel;
};

/**
 * Subscribe to all bookings for a customer (for dashboard live updates).
 */
export const subscribeToCustomerBookings = (customerId, callback) => {
  const channel = supabase
    .channel(`customer-bookings-${customerId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: `customer_id=eq.${customerId}`
    }, callback)
    .subscribe();

  return channel;
};

// --- Utility ---

function combineDateAndTime(dateStr, timeStr) {
  if (!timeStr) return `${dateStr}T00:00:00`;
  const [time, meridian] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridian === 'PM' && hours !== 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;
  return `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function calculateEstimatedEnd(dateStr, timeStr) {
  const startIso = combineDateAndTime(dateStr, timeStr);
  const date = new Date(startIso);
  date.setHours(date.getHours() + 2); // Default to 2 hours duration
  return date.toISOString();
}

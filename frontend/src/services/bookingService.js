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
  
  // 🛡️ INTEGRITY SHIELD: Prevent 'Ghost Bookings' (REQ-SYS-01)
  if (vehicles.length === 0) {
    console.error('CRITICAL: Attempted to create a booking without any vehicles.');
    throw new Error('SYSTEM ERROR: No vehicles provided for this booking session. Operation aborted for integrity.');
  }

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
      end_datetime: calculateEstimatedEnd(bookingData.date, bookingData.time, vehicles), 
      status: bookingData.payment?.method === 'Cash' ? 'confirmed' : 'scheduled',
      total_amount: totalAmount,
      notes: bookingData.notes || '',
      contact_number: bookingData.contactNumber,
      ocr_metadata: bookingData.payment?.ocrData || {} // PERSIST OCR RESULTS
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

    // REQ-CST-10: POPULATE GARAGE (Silent Backend Sync)
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      await fetch(`${BACKEND_URL}/api/garage/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, vehicle })
      });
    } catch (garageEx) {
      console.warn('Silent Garage Sync Failure:', garageEx);
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
        reference_number: bookingData.payment?.ocrData?.referenceNo || '' // Transaction Reference
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
      vehicles:booking_vehicles(*, services:booking_vehicle_services!booking_vehicle_id(*)),
      payments:payments(*),
      assigned_staff:profiles!bookings_staff_id_fkey(first_name, last_name, email)
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
      vehicles:booking_vehicles(*, services:booking_vehicle_services!booking_vehicle_id(*)),
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
  if (!dateStr) return new Date().toISOString();
  if (!timeStr) return `${dateStr}T00:00:00Z`;
  
  try {
    const [time, meridian] = timeStr.split(' ');
    let [hours, minutes = 0] = time.split(':').map(Number);
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    
    // Construct Date in local timezone, then convert to UTC ISO string
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day, hours, minutes, 0);
    
    if (isNaN(d.getTime())) throw new Error('Invalid Date');
    return d.toISOString();
  } catch (e) {
    return `${dateStr}T12:00:00Z`; // Fallback
  }
}

function calculateEstimatedEnd(dateStr, timeStr, vehicles = []) {
  try {
    const startIso = combineDateAndTime(dateStr, timeStr);
    const date = new Date(startIso);
    
    // Calculate total duration across all vehicles and their services
    let totalMinutes = 0;
    vehicles.forEach(v => {
      (v.services || []).forEach(s => {
        totalMinutes += (s.durationMinutes || 60); // Default to 60 if missing
      });
    });

    // Minimum duration of 1 hour if no services selected yet
    if (totalMinutes === 0) totalMinutes = 60;

    date.setMinutes(date.getMinutes() + totalMinutes);
    
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

/**
 * Request a cancellation/refund for a booking.
 */
export const cancelBooking = async (bookingId, reason) => {
  try {
    // 1. Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Update booking status to 'cancelled' and append reason to notes
    const updatedNotes = booking.notes ? `${booking.notes}\nCancellation Reason: ${reason}` : `Cancellation Reason: ${reason}`;
    
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        notes: updatedNotes
      })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // 3. Mark all related vehicles as cancelled to free up the queue
    await supabase
      .from('booking_vehicles')
      .update({ status: 'cancelled' })
      .eq('booking_id', bookingId);

    // 4. Mark associated active payments as REFUND_PENDING
    const { data: payments } = await supabase
      .from('payments')
      .select('id, status')
      .eq('booking_id', bookingId);
      
    if (payments && payments.length > 0) {
      for (const p of payments) {
        if (p.status === 'PAID' || p.status === 'FOR_VERIFICATION') {
          await supabase
            .from('payments')
            .update({ status: 'REFUND_PENDING' })
            .eq('id', p.id);
        }
      }
    }

    // 5. Fire Event for notifications
    await emitEvent(EVENTS.BOOKING_CANCELLED, {
      userId: booking.customer_id,
      bookingId: bookingId,
      meta: { bookingRef: bookingId.substring(0, 8).toUpperCase(), reason }
    });

    return { success: true };
  } catch (err) {
    console.error('Error cancelling booking:', err);
    throw err;
  }
};

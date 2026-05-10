import { supabase } from '../lib/supabase';

/**
 * eventEngine.js — Standardized Event-Driven Notification System
 * 
 * Instead of random, manual notifications, this module defines
 * a strict set of SYSTEM EVENTS and dispatches them uniformly.
 * 
 * USAGE:
 *   import { emitEvent, EVENTS } from '../services/eventEngine';
 *   await emitEvent(EVENTS.BOOKING_CREATED, { userId, bookingId, meta });
 */

// ===== SYSTEM EVENT DEFINITIONS =====
export const EVENTS = {
  BOOKING_CREATED:       'BOOKING_CREATED',
  BOOKING_CONFIRMED:     'BOOKING_CONFIRMED',
  BOOKING_CANCELLED:     'BOOKING_CANCELLED',
  TECHNICIAN_ASSIGNED:   'TECHNICIAN_ASSIGNED',
  PAYMENT_SUBMITTED:     'PAYMENT_SUBMITTED',
  PAYMENT_VERIFIED:      'PAYMENT_VERIFIED',
  PAYMENT_REJECTED:      'PAYMENT_REJECTED',
  SERVICE_STARTED:       'SERVICE_STARTED',
  SERVICE_COMPLETED:     'SERVICE_COMPLETED',
  VEHICLE_COMPLETED:     'VEHICLE_COMPLETED',
  REFUND_PROCESSED:      'REFUND_PROCESSED',
  MESSAGE_RECEIVED:      'MESSAGE_RECEIVED',
  STATUS_UPDATE:         'STATUS_UPDATE'
};

// ===== EVENT → NOTIFICATION TEMPLATE MAP =====
const TEMPLATES = {
  [EVENTS.BOOKING_CREATED]: {
    title: 'Booking Received ✅',
    message: (meta) => `Your booking #${meta.bookingRef} has been submitted and is awaiting confirmation.`,
    type: 'BOOKING_CREATED'
  },
  [EVENTS.BOOKING_CONFIRMED]: {
    title: 'Booking Confirmed 📅',
    message: (meta) => `Your appointment #${meta.bookingRef} has been confirmed by the admin. See you on ${meta.date || 'your scheduled date'}!`,
    type: 'BOOKING_CONFIRMED'
  },
  [EVENTS.BOOKING_CANCELLED]: {
    title: 'Booking Cancelled ❌',
    message: (meta) => `Your booking #${meta.bookingRef} has been cancelled. ${meta.reason || ''}`,
    type: 'STATUS_UPDATE'
  },
  [EVENTS.TECHNICIAN_ASSIGNED]: {
    title: 'Technician Assigned 🔧',
    message: (meta) => `${meta.technicianName} has been assigned to lead the detailing session for your vehicle.`,
    type: 'TASK_ASSIGNED'
  },
  [EVENTS.PAYMENT_SUBMITTED]: {
    title: 'Payment Submitted 💳',
    message: (meta) => `A payment of ₱${meta.amount?.toLocaleString()} has been submitted for booking #${meta.bookingRef}. Awaiting verification.`,
    type: 'PAYMENT_SUBMITTED'
  },
  [EVENTS.PAYMENT_VERIFIED]: {
    title: 'Payment Verified! 💰',
    message: (meta) => `Your payment of ₱${meta.amount?.toLocaleString()} has been approved. Thank you!`,
    type: 'PAYMENT_VERIFIED'
  },
  [EVENTS.PAYMENT_REJECTED]: {
    title: 'Payment Rejected ❌',
    message: (meta) => `Your payment was rejected. Reason: ${meta.reason || 'Not specified'}. Please re-submit your receipt.`,
    type: 'PAYMENT_REJECTED'
  },
  [EVENTS.SERVICE_STARTED]: {
    title: 'Service In Progress 🚗',
    message: (meta) => `Work has begun on your ${meta.vehicleName || 'vehicle'}. Track live progress from your dashboard.`,
    type: 'STATUS_UPDATE'
  },
  [EVENTS.SERVICE_COMPLETED]: {
    title: 'Service Completed! ✨',
    message: (meta) => `All services for booking #${meta.bookingRef} are now complete. Your vehicle is ready for pickup!`,
    type: 'STATUS_UPDATE'
  },
  [EVENTS.VEHICLE_COMPLETED]: {
    title: 'Unit Ready! 🏁',
    message: (meta) => `Your ${meta.vehicleName || 'vehicle'} is now ready for pickup.`,
    type: 'STATUS_UPDATE'
  },
  [EVENTS.REFUND_PROCESSED]: {
    title: 'Refund Processed 💸',
    message: (meta) => `A refund of ₱${meta.amount?.toLocaleString()} has been processed for booking #${meta.bookingRef}.`,
    type: 'REFUND_PROCESSED'
  },
  [EVENTS.MESSAGE_RECEIVED]: {
    title: 'New Message 💬',
    message: (meta) => `${meta.senderName || 'Someone'} sent a message on booking #${meta.bookingRef}.`,
    type: 'MESSAGE_RECEIVED'
  },
  [EVENTS.STATUS_UPDATE]: {
    title: 'Status Updated ℹ️',
    message: (meta) => `Your booking #${meta.bookingRef} has been updated to: ${meta.status?.toUpperCase()}.`,
    type: 'STATUS_UPDATE'
  }
};

// ===== CORE DISPATCHER =====

/**
 * Emit a system event — creates a notification for the target user.
 * @param {string} eventType - One of EVENTS.*
 * @param {object} params - { userId, bookingId, meta: { bookingRef, amount, ... } }
 */
export const emitEvent = async (eventType, { userId, bookingId, meta = {} }) => {
  const template = TEMPLATES[eventType];
  if (!template) {
    console.warn(`[EventEngine] Unknown event type: ${eventType}`);
    return;
  }

  const notification = {
    user_id: userId,
    title: template.title,
    message: template.message(meta),
    notification_type: template.type,
    action_url: bookingId ? `/customer/bookings/${bookingId}` : null,
    is_read: false
  };

  const { error } = await supabase.from('notifications').insert(notification);

  if (error) {
    console.error(`[EventEngine] Failed to emit ${eventType}:`, error);
  }

  // Also insert a system message into the booking chat thread (if booking-related)
  if (bookingId && eventType !== EVENTS.MESSAGE_RECEIVED) {
    try {
      await supabase.from('booking_messages').insert({
        booking_id: bookingId,
        sender_id: userId,
        message: `[SYSTEM] ${template.title} — ${template.message(meta)}`,
        message_type: 'system'
      });
    } catch (e) {
      // Silently fail if table doesn't support it or RLS blocks it
    }
  }

  // ===== TASK 3: AUDIT PERSISTENCE =====
  try {
    const { data: { user: actor } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      booking_id: bookingId,
      action_type: eventType,
      actor_name: actor?.email || 'System',
      actor_role: actor ? 'ADMIN' : 'SYSTEM',
      details: template.message(meta),
      created_at: new Date().toISOString()
    });
  } catch (auditError) {
    console.error('[EventEngine] Audit persistence failed:', auditError);
  }
};

/**
 * Emit an event to MULTIPLE users (e.g., notify both customer AND admin).
 */
export const emitEventToMany = async (eventType, { userIds = [], bookingId, meta = {} }) => {
  const promises = userIds.map(userId => emitEvent(eventType, { userId, bookingId, meta }));
  await Promise.allSettled(promises);
};

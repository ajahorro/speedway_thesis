import { STATUS_COLORS, BOOKING_STATUSES, SHOP_CONFIG, THRESHOLDS } from '../config/constants';

/**
 * bookingHelpers.js
 * REQ-NFR-01: Decoupled helper functions for status transitions,
 * capacity calculations, and staff validation.
 * No UI logic — pure business rules only.
 */

// ─── STATUS COLOR ────────────────────────────────────────────────
/**
 * Returns the hex/css color for a given booking or vehicle status.
 * Single source — replaces inline getStatusColor() in 4+ components.
 */
export const getStatusColor = (status) => {
  return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.default;
};

// ─── STATUS LABEL ────────────────────────────────────────────────
/**
 * Returns a human-readable label for a status string.
 */
export const getStatusLabel = (status) => {
  const labels = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    flagged_noshow: 'No-Show',
    queued: 'Queued',
    pending: 'Pending',
  };
  return labels[status?.toLowerCase()] || status?.toUpperCase() || 'Unknown';
};

// ─── STATUS TRANSITIONS ─────────────────────────────────────────
/**
 * Returns whether a booking can transition from `current` to `target`.
 * Guards against invalid state changes in the command bar.
 */
export const canTransitionTo = (current, target) => {
  const transitions = {
    [BOOKING_STATUSES.SCHEDULED]: [BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CANCELLED],
    [BOOKING_STATUSES.CONFIRMED]: [BOOKING_STATUSES.IN_PROGRESS, BOOKING_STATUSES.CANCELLED],
    [BOOKING_STATUSES.IN_PROGRESS]: [BOOKING_STATUSES.COMPLETED, BOOKING_STATUSES.CANCELLED],
    [BOOKING_STATUSES.COMPLETED]: [],
    [BOOKING_STATUSES.CANCELLED]: [],
    [BOOKING_STATUSES.FLAGGED_NOSHOW]: [BOOKING_STATUSES.CANCELLED, BOOKING_STATUSES.IN_PROGRESS],
  };
  return (transitions[current] || []).includes(target);
};

// ─── OVERDUE CHECK ───────────────────────────────────────────────
/**
 * Returns true if a booking has exceeded the no-show grace period.
 * REQ-SYS-02: 30-minute trigger.
 */
export const isBookingOverdue = (booking, graceMins = THRESHOLDS.NOSHOW_GRACE_MINUTES) => {
  if (!booking?.start_datetime) return false;
  const start = new Date(booking.start_datetime);
  const now = new Date();
  const diffMins = (now - start) / (1000 * 60);
  const activeStatuses = [BOOKING_STATUSES.IN_PROGRESS, BOOKING_STATUSES.COMPLETED, BOOKING_STATUSES.CANCELLED];
  return diffMins > graceMins && !activeStatuses.includes(booking.status);
};

// ─── FLEET CAPACITY ──────────────────────────────────────────────
/**
 * Calculates the effective capacity cap for a set of bookings.
 * REQ-CST-01: Mixed Fleet Ceiling — if ANY car is present, use car cap (7).
 * Motorcycle-only sessions use the 15-unit cap.
 */
export const calculateFleetCapacity = (vehicles = []) => {
  const hasCar = vehicles.some(v => {
    const type = (v.vehicle_type || '').toLowerCase();
    return ['sedan', 'suv', 'van/l300', 'car'].includes(type);
  });
  return hasCar ? SHOP_CONFIG.MAX_BAYS : SHOP_CONFIG.MAX_MOTORCYCLE_BAYS;
};

// ─── STAFF AVAILABILITY ─────────────────────────────────────────
/**
 * Returns true if a staff member is currently occupied (assigned to
 * any in_progress booking). Dynamic — no hardcoded staff count.
 */
export const isStaffOccupied = (staffId, allBookings = []) => {
  return allBookings.some(
    b => b.staff_id === staffId && b.status === BOOKING_STATUSES.IN_PROGRESS
  );
};

// ─── VEHICLE QUEUE BREAKDOWN ─────────────────────────────────────
/**
 * Splits a booking's vehicles into queue status groups.
 * REQ-CST-01: Customer Dashboard distinguishes IN_PROGRESS vs QUEUED.
 */
export const getVehicleQueueBreakdown = (vehicles = []) => {
  return {
    inProgress: vehicles.filter(v => v.status === 'in_progress' || v.status === 'IN_PROGRESS'),
    queued: vehicles.filter(v => v.status === 'QUEUED'),
    completed: vehicles.filter(v => v.status === 'completed' || v.status === 'COMPLETED'),
    pending: vehicles.filter(v => !v.status || v.status === 'pending'),
  };
};

// ─── FINANCIAL FILTERS ──────────────────────────────────────────
/**
 * REQ-ADM-05: Strict filter to exclude refund records from 
 * the primary payment verification pipeline.
 */
export const getAuditCompliantTransactions = (payments = []) => {
  return payments.filter(p => 
    p.transaction_type !== 'REFUND' && 
    p.status !== 'REFUND_PENDING' &&
    p.status !== 'REFUNDED'
  );
};

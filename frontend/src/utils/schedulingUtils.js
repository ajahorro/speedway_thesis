import { CAPACITY_THRESHOLD, COLORS, SHOP_CONFIG } from '../config/constants';

/**
 * Scheduling & Occupancy Utilities
 * Consolidates 'Range Overlap' and 'Duration Awareness' math.
 */

/**
 * Checks if a requested time window overlaps with an existing booking.
 */
export const isOverlapping = (startA, endA, startB, endB) => {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
};

/**
 * Calculates total duration for all vehicles in a booking.
 */
export const calculateTotalDuration = (vehicles = []) => {
  return vehicles.reduce((total, v) => {
    return total + (v.services || []).reduce((sub, s) => sub + (s.durationMinutes || 60), 0);
  }, 0) || 60;
};

/**
 * Returns the status color based on bay occupancy.
 */
export const getOccupancyColor = (count) => {
  if (count >= CAPACITY_THRESHOLD.CRITICAL) return COLORS.DANGER;
  if (count >= CAPACITY_THRESHOLD.HIGH) return COLORS.WARNING;
  if (count >= CAPACITY_THRESHOLD.LOW) return COLORS.SUCCESS;
  return COLORS.MUTED;
};

/**
 * Formats 24h hour to display string (e.g., 13 -> "1 PM").
 */
export const formatDisplayHour = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
};

/**
 * Filters bookings into Transient vs Long-Term (Full Day).
 */
export const segregateBookings = (bookings = []) => {
  const fullDay = [];
  const transient = [];

  bookings.forEach(b => {
    const duration = (new Date(b.end_datetime) - new Date(b.start_datetime)) / (1000 * 60);
    if (duration >= SHOP_CONFIG.FULL_DAY_THRESHOLD_MINUTES) {
      fullDay.push(b);
    } else {
      transient.push(b);
    }
  });

  return { fullDay, transient };
};

/**
 * Calculates how many resources are occupied at a specific hour on a specific date.
 */
export const calculateOccupancy = (hour, dateStr, activeBookings = [], blocks = []) => {
  let count = 0;
  const checkTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  
  // Check Bookings
  activeBookings.forEach(b => {
    const start = new Date(b.start_datetime);
    const end = new Date(b.end_datetime);
    if (checkTime >= start && checkTime < end) count++;
  });

  // Check Maintenance Blocks
  blocks.forEach(b => {
    if (!b.start_time) count = SHOP_CONFIG.MAX_BAYS; // Whole day block
    else {
      const bStart = parseInt(b.start_time.split(':')[0], 10);
      const bEnd = parseInt(b.end_time.split(':')[0], 10);
      if (hour >= bStart && hour < bEnd) count = SHOP_CONFIG.MAX_BAYS;
    }
  });

  return count;
};

/**
 * Filters out stale pending sessions.
 */
export const filterActiveBookings = (bookings = []) => {
  const now = new Date();
  return (bookings || []).filter(b => {
    if (b.status === 'scheduled') {
      const start = new Date(b.start_datetime);
      const diffMins = (now - start) / (1000 * 60);
      return diffMins <= SHOP_CONFIG.STALE_SESSION_PURGE_MINUTES;
    }
    return true;
  });
};

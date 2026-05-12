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
export const segregateBookings = (bookings = [], config = SHOP_CONFIG) => {
  const fullDay = [];
  const transient = [];

  bookings.forEach(b => {
    const duration = (new Date(b.end_datetime) - new Date(b.start_datetime)) / (1000 * 60);
    if (duration >= config.FULL_DAY_THRESHOLD_MINUTES) {
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
export const calculateOccupancy = (hour, dateStr, activeBookings = [], blocks = [], config = SHOP_CONFIG) => {
  let count = 0;
  const checkTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00Z`);
  
  // Check Bookings (Granular Vehicle Occupancy)
  activeBookings.forEach(b => {
    const start = new Date(b.start_datetime);
    const end = new Date(b.end_datetime);
    
    if (checkTime >= start && checkTime < end) {
      // RELEASE LOGIC: Only count vehicles that are NOT completed
      const activeVehicleCount = (b.vehicles || []).filter(v => 
        v.status !== 'COMPLETED' && v.status !== 'completed'
      ).length;
      
      // Fallback to 1 if vehicles are missing (legacy or single-unit bookings without relation)
      count += activeVehicleCount || 1;
    }
  });

  // Check Maintenance Blocks
  blocks.forEach(b => {
    if (!b.start_time) count = config.MAX_BAYS; // Whole day block
    else {
      const bStart = parseInt(b.start_time.split(':')[0], 10);
      const bEnd = parseInt(b.end_time.split(':')[0], 10);
      if (hour >= bStart && hour < bEnd) count = config.MAX_BAYS;
    }
  });

  return count;
};

/**
 * Filters out stale pending sessions.
 */
export const filterActiveBookings = (bookings = [], config = SHOP_CONFIG) => {
  const now = new Date();
  return (bookings || []).filter(b => {
    if (b.status === 'scheduled') {
      const start = new Date(b.start_datetime);
      const diffMins = (now - start) / (1000 * 60);
      return diffMins <= config.STALE_SESSION_PURGE_MINUTES;
    }
    return true;
  });
};

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
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${String(displayHour).padStart(2, '0')}:00 ${ampm}`;
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
 * Returns the bay weight for a given vehicle type.
 * Motorcycles and big bikes = 0.5 bays (2 of them share 1 bay).
 * All other vehicle types = 1.0 bay.
 */
export const getVehicleWeight = (vehicleType = '') => {
  const type = (vehicleType || '').toUpperCase();
  if (type === 'MOTORCYCLE' || type === 'BIG_BIKE' || type === 'MOTORBIKE') return 0.5;
  return 1.0;
};

/**
 * Calculates how many bay-units are occupied at a specific hour on a specific date.
 * Uses weighted occupancy: motorcycles = 0.5, all others = 1.0.
 */
export const calculateOccupancy = (hour, dateStr, activeBookings = [], blocks = [], config = SHOP_CONFIG) => {
  let count = 0;
  const checkTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  
  // Check Bookings (Weighted Vehicle Occupancy)
  activeBookings.forEach(b => {
    const start = new Date(b.start_datetime.substring(0, 19));
    const end = new Date(b.end_datetime.substring(0, 19));
    
    if (checkTime >= start && checkTime < end) {
      const activeVehicles = (b.vehicles || []).filter(v => 
        v.status !== 'COMPLETED' && v.status !== 'completed'
      );
      
      if (activeVehicles.length > 0) {
        // Sum weighted occupancy per vehicle type
        const weightedCount = activeVehicles.reduce((sum, v) => sum + getVehicleWeight(v.vehicle_type || v.type), 0);
        count += weightedCount;
      } else {
        // Fallback: legacy bookings without vehicle relation
        count += 1;
      }
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

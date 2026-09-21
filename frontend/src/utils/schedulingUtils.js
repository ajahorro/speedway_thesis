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

export const formatDisplayTime = (hour, minute = 0) => {
  const normalizedHour = hour % 24;
  const displayHour = normalizedHour === 0 ? 12 : normalizedHour > 12 ? normalizedHour - 12 : normalizedHour;
  const ampm = normalizedHour >= 12 ? 'PM' : 'AM';
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
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
  if (['REGULAR', 'BIGBIKE', 'MOTORCYCLE', 'BIG_BIKE', 'MOTORBIKE'].includes(type)) return 0.5;
  return 1.0;
};

export const isBikeVehicleType = (vehicleType = '') => getVehicleWeight(vehicleType) === 0.5;

/**
 * Counts occupied bays without allowing a car to share a half-used bike bay.
 * Two bikes can share one bay; every other vehicle needs a whole bay.
 */
export const calculateBayUsage = (vehicles = []) => {
  const bikeCount = vehicles.filter(vehicle => isBikeVehicleType(vehicle.vehicle_type || vehicle.type || vehicle.vehicleType)).length;
  const fullBayCount = vehicles.length - bikeCount;
  return fullBayCount + Math.ceil(bikeCount / 2);
};

/**
 * Calculates how many bay-units are occupied at a specific hour on a specific date.
 * Uses weighted occupancy: motorcycles = 0.5, all others = 1.0.
 */
export const calculateOccupancy = (hour, dateStr, activeBookings = [], blocks = [], config = SHOP_CONFIG, minute = 0) => {
  let count = 0;
  const checkTime = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  
  // Check Bookings (Weighted Vehicle Occupancy)
  const occupiedVehicles = [];
  let legacyBayCount = 0;
  activeBookings.forEach(b => {
    const start = new Date(b.start_datetime.substring(0, 19));
    const end = new Date(b.end_datetime.substring(0, 19));
    
    if (checkTime >= start && checkTime < end) {
      const activeVehicles = (b.vehicles || []).filter(v => 
        v.status !== 'COMPLETED' && v.status !== 'completed'
      );
      
      if (activeVehicles.length > 0) {
        occupiedVehicles.push(...activeVehicles);
      } else {
        // Fallback: legacy bookings without vehicle relation
        legacyBayCount += 1;
      }
    }
  });

  count += occupiedVehicles.length > 0 ? calculateBayUsage(occupiedVehicles) : 0;
  count += legacyBayCount;

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
    const status = String(b.status || '').toLowerCase();
    if (['cancelled', 'completed', 'flagged_noshow', 'released'].includes(status)) return false;
    if (status === 'scheduled') {
      const start = new Date(b.start_datetime);
      const diffMins = (now - start) / (1000 * 60);
      return diffMins <= config.STALE_SESSION_PURGE_MINUTES;
    }
    return true;
  });
};

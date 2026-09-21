import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { SHOP_CONFIG } from '../config/constants';
import { 
  filterActiveBookings, 
  formatDisplayTime
} from '../utils/schedulingUtils';

/**
 * scheduleService.js
 * Handles bay capacity checks and slot availability for booking wizard.
 */

/**
 * Check how many bookings exist for a given date and time slot.
 * Returns the list of available time slots for that date.
 */
export const getAvailableSlots = async (dateStr, requestedDuration = 60, requestedVehicles = [], excludedBookingId = null) => {
  try {
    const { data: config } = await supabase.from('business_config').select('opening_hour, closing_hour, slots_per_hour').maybeSingle();
    
    let startHour = SHOP_CONFIG.OPENING_HOUR;
    let endHour = SHOP_CONFIG.CLOSING_HOUR;
    let maxBays = SHOP_CONFIG.MAX_BAYS;
    
    if (config) {
      const parseHour = (timeStr) => {
        if (!timeStr) return null;
        const upperTime = timeStr.toUpperCase();
        if (!upperTime.includes('AM') && !upperTime.includes('PM')) {
           return parseInt(upperTime.split(':')[0], 10);
        }
        const [time, modifier] = upperTime.split(' ');
        let [h] = time.split(':');
        h = parseInt(h, 10);
        if (modifier === 'PM' && h < 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
        return h;
      };
      const parsedStart = parseHour(config.opening_hour);
      const parsedEnd = parseHour(config.closing_hour);
      if (parsedStart !== null) startHour = parsedStart;
      if (parsedEnd !== null) endHour = parsedEnd;
      const configuredBays = Number(config.slots_per_hour);
      if (Number.isFinite(configuredBays) && configuredBays > 0) maxBays = configuredBays;
    }

    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
      logger.warn('Invalid business hours; using shop defaults.', { opening: config?.opening_hour, closing: config?.closing_hour });
      startHour = SHOP_CONFIG.OPENING_HOUR;
      endHour = SHOP_CONFIG.CLOSING_HOUR;
    }
    maxBays = Math.max(1, Number(maxBays) || SHOP_CONFIG.MAX_BAYS);

    // 1. Fetch ALL bookings and blocks for the range (Local String Matching)
    // We fetch 3 days ahead to handle multi-day duration checks
    const startOfDay = `${dateStr}T00:00:00`;
    const checkDateEnd = new Date(dateStr);
    checkDateEnd.setDate(checkDateEnd.getDate() + Math.ceil(requestedDuration / 1440) + 1);
    const endOfRange = `${checkDateEnd.toISOString().split('T')[0]}T23:59:59`;

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, start_datetime, end_datetime, status, vehicles:booking_vehicles(id, status, vehicle_type)')
      .lte('start_datetime', endOfRange)
      .gte('end_datetime', startOfDay)
      .not('status', 'in', '("CANCELLED","cancelled","COMPLETED","completed","FLAGGED_NOSHOW","flagged_noshow","RELEASED","released")');

    const { data: blocks, error: blocksError } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('block_date', dateStr);
    const safeBlocks = blocksError
      ? (logger.warn('Blocked slots unavailable; continuing without maintenance blocks.', blocksError), [])
      : (blocks || []);

    // 2. Filter active sessions using shared utility
    const activeBookings = filterActiveBookings(bookings || [])
      .filter(booking => booking.id !== excludedBookingId);
    logger.debug('Schedule availability inputs', {
      date: dateStr,
      requestedDuration,
      requestedBookings: 1,
      maxBays,
      activeBookings: activeBookings.length,
      blockedSlots: safeBlocks.length
    });

    // 3. Generate ALL possible start slots
    const ALL_SLOTS = [];
    for (let h = startHour; h < endHour; h++) {
      for (let minute = 0; minute < 60; minute += 30) {
        ALL_SLOTS.push({ hour: h, minute, time: formatDisplayTime(h, minute) });
      }
    }

    const requestedStart = new Date(`${dateStr}T00:00:00`);
    const requestedEnd = new Date(requestedStart.getTime() + requestedDuration * 60000);
    const relevantBookings = activeBookings.filter(booking => {
      const start = new Date(booking.start_datetime);
      const end = new Date(booking.end_datetime);
      return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < requestedEnd && end > requestedStart;
    });
    if (relevantBookings.length === 0 && safeBlocks.length === 0) {
      const now = new Date();
      const localToday = now.toLocaleDateString('en-CA');
      return ALL_SLOTS.filter(slot => {
        const slotDateTime = new Date(`${dateStr}T${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}:00`);
        if (dateStr === localToday && slotDateTime <= now) return false;
        return true;
      }).map(slot => ({ ...slot, availableBays: maxBays }));
    }

    const now = new Date();
    const localToday = now.toLocaleDateString('en-CA');
    const isToday = dateStr === localToday;

    // 4. Filter slots based on DURATION AWARENESS
    return ALL_SLOTS.map(slot => {
      const slotDateTime = new Date(`${dateStr}T${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}:00`);

      // Rule: Can't book in the past
      if (isToday && slotDateTime <= now) return null;

      // Rule: Check capacity every 30 minutes across the requested duration.
      const durationSteps = Math.max(1, Math.ceil(requestedDuration / 30));
      let highestOccupancy = 0;

      for (let step = 0; step < durationSteps; step++) {
        const absoluteMinutes = slot.hour * 60 + slot.minute + step * 30;
        let checkDate = new Date(dateStr);
        let checkMinutes = absoluteMinutes;
        
        const daysToSkip = Math.floor(checkMinutes / 1440);
        checkMinutes %= 1440;
        checkDate.setDate(checkDate.getDate() + daysToSkip);

        const checkDateStr = checkDate.toISOString().split('T')[0];
        const checkStart = new Date(`${checkDateStr}T${String(Math.floor(checkMinutes / 60)).padStart(2, '0')}:${String(checkMinutes % 60).padStart(2, '0')}:00`);
        const checkEnd = new Date(checkStart.getTime() + 30 * 60000);
        const isBlocked = safeBlocks.some(block => {
          if (!block.start_time) return true;
          const blockStart = block.start_time.slice(0, 5);
          const blockEnd = block.end_time?.slice(0, 5) || '23:59';
          const time = checkStart.toTimeString().slice(0, 5);
          return time >= blockStart && time < blockEnd;
        });
        const overlappingBookings = activeBookings.filter(booking => {
          const bookingStart = new Date(booking.start_datetime);
          const bookingEnd = new Date(booking.end_datetime);
          return bookingStart < checkEnd && bookingEnd > checkStart;
        });
        const occupiedBookings = isBlocked ? maxBays : overlappingBookings.length;
        highestOccupancy = Math.max(highestOccupancy, occupiedBookings);
        if (occupiedBookings >= maxBays) {
          return null;
        }
      }

      return { time: slot.time, availableBays: Math.max(0, maxBays - highestOccupancy) };
    }).filter(Boolean);
  } catch (err) {
    logger.error('Schedule Service Error', err);
    return [];
  }
};

/**
 * Fetch business operating hours from business_config.
 * Can be used to dynamically generate slot ranges.
 */
export const getBusinessHours = async () => {
  const { data, error } = await supabase
    .from('business_config')
    .select('opening_hour, closing_hour')
    .maybeSingle();

  if (error || !data) return { opening: '08:00 AM', closing: '06:00 PM' };
  return { opening: data.opening_hour, closing: data.closing_hour };
};

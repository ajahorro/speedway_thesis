import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { SHOP_CONFIG } from '../config/constants';
import { 
  calculateOccupancy, 
  filterActiveBookings, 
  formatDisplayHour 
} from '../utils/schedulingUtils';

/**
 * scheduleService.js
 * Handles bay capacity checks and slot availability for booking wizard.
 */

/**
 * Check how many bookings exist for a given date and time slot.
 * Returns the list of available time slots for that date.
 */
export const getAvailableSlots = async (dateStr, requestedDuration = 60) => {
  try {
    const { data: config } = await supabase.from('business_config').select('opening_hour, closing_hour').limit(1).single();
    
    let startHour = SHOP_CONFIG.OPENING_HOUR;
    let endHour = SHOP_CONFIG.CLOSING_HOUR;
    
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
    }

    // 1. Fetch ALL bookings and blocks for the day
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, start_datetime, end_datetime, status')
      .lte('start_datetime', endOfDay)
      .gte('end_datetime', startOfDay)
      .neq('status', 'CANCELLED');

    const { data: blocks } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('date', dateStr);

    // 2. Filter active sessions using shared utility
    const activeBookings = filterActiveBookings(bookings || []);

    // 3. Generate ALL possible start slots
    const ALL_SLOTS = [];
    for (let h = startHour; h < endHour; h++) {
       ALL_SLOTS.push(formatDisplayHour(h));
    }

    const now = new Date();
    const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = dateStr === localToday;
    const currentHour = now.getHours();

    // 4. Filter slots based on DURATION AWARENESS
    return ALL_SLOTS.filter(slot => {
      let [time, modifier] = slot.split(' ');
      let slotH = parseInt(time.split(':')[0], 10);
      if (modifier === 'PM' && slotH < 12) slotH += 12;
      if (modifier === 'AM' && slotH === 12) slotH = 0;

      // Rule: Can't book in the past
      if (isToday && slotH <= currentHour) return false;

      // Rule: Check if EACH hour of the requested duration has capacity
      const durationHours = Math.ceil(requestedDuration / 60);
      for (let offset = 0; offset < durationHours; offset++) {
        const targetH = slotH + offset;
        // Don't book past closing
        if (targetH >= endHour) return false;
        
        if (calculateOccupancy(targetH, dateStr, activeBookings, blocks || []) >= SHOP_CONFIG.MAX_BAYS) {
          return false;
        }
      }

      return true;
    });
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
    .limit(1)
    .single();

  if (error) return { opening: '08:00 AM', closing: '06:00 PM' };
  return { opening: data.opening_hour, closing: data.closing_hour };
};

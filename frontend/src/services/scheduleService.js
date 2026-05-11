import { supabase } from '../lib/supabase';

/**
 * scheduleService.js
 * Handles bay capacity checks and slot availability for booking wizard.
 */

const MAX_BAYS = 7; // Maximum simultaneous bookings per time slot

/**
 * Check how many bookings exist for a given date and time slot.
 * Returns the list of available time slots for that date.
 */
export const getAvailableSlots = async (dateStr) => {
  try {
    const { data: config, error: configError } = await supabase.from('business_config').select('opening_hour, closing_hour').limit(1).single();
    
    if (configError) console.warn('ScheduleService: Could not fetch business hours, using defaults.', configError);
    else console.log('ScheduleService: Fetched business hours:', config);

    let startHour = 8;
    let endHour = 17; // 5 PM
    
    if (config) {
      const parseHour = (timeStr) => {
        if (!timeStr) return null;
        console.log(`ScheduleService: Parsing time string: "${timeStr}"`);
        const upperTime = timeStr.toUpperCase();
        
        // Handle HH:mm:ss (Postgres time) or HH:mm
        if (!upperTime.includes('AM') && !upperTime.includes('PM')) {
           const parts = upperTime.split(':');
           return parseInt(parts[0], 10);
        }
        
        // Handle hh:mm AM/PM
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

    const ALL_SLOTS = [];
    // Generate hourly slots from startHour to endHour
    for (let h = startHour; h <= endHour; h++) {
       let meridian = h >= 12 ? 'PM' : 'AM';
       let displayH = h > 12 ? h - 12 : h;
       if (displayH === 0) displayH = 12;
       ALL_SLOTS.push(`${String(displayH).padStart(2, '0')}:00 ${meridian}`);
    }

    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    // 1. Check for Blocked Slots (REQ-ADM-07)
    const { data: blocks } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('block_date', dateStr);
    
    if (blocks && blocks.some(b => !b.start_time)) {
      console.log('ScheduleService: Whole day is blocked.');
      return []; // Whole day blocked
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('start_datetime')
      .gte('start_datetime', startOfDay)
      .lte('start_datetime', endOfDay)
      .neq('status', 'CANCELLED');

    if (error) throw error;

    const slotCounts = {};
    (bookings || []).forEach(b => {
      const dt = new Date(b.start_datetime);
      let hours = dt.getHours();
      let meridian = hours >= 12 ? 'PM' : 'AM';
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      const slotKey = `${String(hours).padStart(2, '0')}:00 ${meridian}`;
      slotCounts[slotKey] = (slotCounts[slotKey] || 0) + 1;
    });

    const now = new Date();
    // Use local date string comparison to avoid UTC date offset issues for filtering past hours
    const localToday = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = dateStr === localToday;
    const currentHour = now.getHours();

    const available = ALL_SLOTS.filter(slot => {
      // 1. Check capacity
      if ((slotCounts[slot] || 0) >= MAX_BAYS) return false;
      
      // 2. Check if past time (if booking is for today)
      if (isToday) {
        let [time, modifier] = slot.split(' ');
        let slotH = parseInt(time.split(':')[0], 10);
        if (modifier === 'PM' && slotH < 12) slotH += 12;
        if (modifier === 'AM' && slotH === 12) slotH = 0;
        
        // Block slots if they are in the past or exactly current hour
        if (slotH <= currentHour) return false;
      }

      // 3. Check against Time-Specific Blocks
      if (blocks && blocks.length > 0) {
        const parseSlotH = (slotStr) => {
          let [time, modifier] = slotStr.split(' ');
          let h = parseInt(time.split(':')[0], 10);
          if (modifier === 'PM' && h < 12) h += 12;
          if (modifier === 'AM' && h === 12) h = 0;
          return h;
        };
        const sH = parseSlotH(slot);
        
        const isBlocked = blocks.some(b => {
          if (!b.start_time) return false; // Handled by whole-day check
          const bStart = parseInt(b.start_time.split(':')[0], 10);
          const bEnd = parseInt(b.end_time.split(':')[0], 10);
          return sH >= bStart && sH < bEnd;
        });
        if (isBlocked) return false;
      }
      
      return true;
    });

    return available;
  } catch (err) {
    console.error('Schedule Service Error:', err);
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

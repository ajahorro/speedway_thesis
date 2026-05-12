
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function purgeInvalidBookings() {
  console.log('🚀 INITIALIZING DATABASE PURGE...');

  // 1. Fetch all bookings using the primary 'id'
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id');

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`🔍 Scanning ${bookings.length} records for integrity...`);

  let purgedCount = 0;

  for (const b of bookings) {
    // Check if this booking has any vehicles registered
    const { data: vehicles } = await supabase
      .from('booking_vehicles')
      .select('id')
      .eq('booking_id', b.id);

    if (!vehicles || vehicles.length === 0) {
      console.log(`⚠️  INTEGRITY BREACH: Booking ID ${b.id} has NO vehicles. Purging...`);
      
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', b.id);

      if (deleteError) {
        console.error(`❌ Failed to purge ${b.id}:`, deleteError);
      } else {
        purgedCount++;
      }
    }
  }

  console.log(`✅ PURGE COMPLETE. Removed ${purgedCount} invalid 'Ghost Bookings'.`);
}

purgeInvalidBookings();

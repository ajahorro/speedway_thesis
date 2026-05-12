
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for cleanup
);

async function purgeInvalidBookings() {
  console.log('🚀 INITIALIZING DATABASE PURGE...');

  // 1. Find all bookings
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_id');

  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`🔍 Scanning ${bookings.length} records for integrity...`);

  let purgedCount = 0;

  for (const b of bookings) {
    // Check if this booking has any vehicles
    const { data: vehicles } = await supabase
      .from('booking_vehicles')
      .select('id')
      .eq('booking_id', b.id);

    if (!vehicles || vehicles.length === 0) {
      console.log(`⚠️  INTEGRITY BREACH: Booking ${b.booking_id || b.id} has NO vehicles. Purging...`);
      
      // Delete the booking (Cascade should handle the rest if anything exists)
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

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  const ref = '069F4AEF';
  console.log(`🔍 DIAGNOSING BOOKING REF: ${ref}`);
  
  // 1. Find the booking
  const { data: bookings, error: bError } = await supabase
    .from('bookings')
    .select('id, status, customer_id')
    .ilike('id', `${ref.toLowerCase()}%`);
  
  if (bError || !bookings || bookings.length === 0) {
    console.error('❌ Booking not found:', bError);
    return;
  }
  
  const booking = bookings[0];
  console.log(`✅ Master Booking Found: ID=${booking.id}, Status='${booking.status}'`);
  
  // 2. Find vehicles
  const { data: vehicles, error: vError } = await supabase
    .from('booking_vehicles')
    .select('id, status, brand, model')
    .eq('booking_id', booking.id);
    
  if (vError) {
    console.error('❌ Vehicles error:', vError);
  } else {
    console.log(`🚗 Vehicles (${vehicles.length}):`);
    vehicles.forEach(v => {
      console.log(`   - [${v.id.slice(0,8)}] ${v.brand} ${v.model}: Status='${v.status}'`);
    });
  }
  
  // 3. Test Propagation Logic (Dry Run)
  const statuses = (vehicles || []).map(u => u.status?.toUpperCase());
  const anyInProgress = statuses.includes('IN_PROGRESS');
  const allCompleted = statuses.every(s => s === 'COMPLETED' || s === 'CANCELLED');
  const currentMaster = booking.status?.toLowerCase();
  
  console.log(`\n🧪 Propagation Simulation:`);
  console.log(`   - anyInProgress: ${anyInProgress}`);
  console.log(`   - allCompleted: ${allCompleted}`);
  console.log(`   - currentMaster: '${currentMaster}'`);
  
  if (anyInProgress && currentMaster !== 'in_progress' && currentMaster !== 'completed') {
    console.log(`   🚀 RESULT: Master status SHOULD be updated to 'in_progress'`);
  } else if (allCompleted && currentMaster !== 'completed') {
    console.log(`   🚀 RESULT: Master status SHOULD be updated to 'completed'`);
  } else {
    console.log(`   ℹ️ RESULT: No master update needed according to current logic.`);
  }
}

diagnose();

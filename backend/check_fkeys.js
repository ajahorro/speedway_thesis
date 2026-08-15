require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tests = [
    // 1. useAdminBookings & AdminRefunds query
    ['bookings', `
      *,
      customer:profiles!bookings_customer_id_fkey(full_name, email),
      vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*),
      payments:payments!payments_booking_id_fkey(*)
    `],

    // 2. AdminPayments query
    ['payments', `
      *,
      booking:bookings!payments_booking_id_fkey (
        *,
        customer:profiles!bookings_customer_id_fkey (full_name, email),
        vehicles:booking_vehicles!booking_vehicles_booking_id_fkey (
          *,
          services:booking_vehicle_services (*)
        )
      )
    `],

    // 3. AdminSchedule query
    ['bookings', `
      *,
      vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*, services:booking_vehicle_services(*))
    `],

    // 4. AdminSalesReport query
    ['payments', `
      *,
      booking:bookings!payments_booking_id_fkey(
        id, 
        customer_id,
        vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(
          *,
          services:booking_vehicle_services(*)
        )
      )
    `],

    // 5. AdminAuditLogs query
    ['audit_logs', `*`]
  ];

  for (let i = 0; i < tests.length; i++) {
    const [table, select] = tests[i];
    const { error: e } = await supabase.from(table).select(select).limit(0);
    console.log(`Test ${i + 1} (${table}) : ${e ? '❌ FAIL: ' + e.message : '✅ OK'}`);
  }
}

run();

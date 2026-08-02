require('dotenv').config();
const https = require('https');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use the REST API directly to query pg_catalog for foreign keys
const { createClient } = require('@supabase/supabase-js');
const s = createClient(url, key);

async function run() {
  // Use a raw SQL approach via a temporary RPC function
  const { data, error } = await s.rpc('get_my_role');
  console.log('Current role:', data, error);

  // Try to get FK info by testing specific hint names
  const tests = [
    ['bookings', '*, bv:booking_vehicles!booking_vehicles_booking_id_fkey(*)'],
    ['bookings', '*, bv:booking_vehicles!bookings_id_fkey(*)'],
    ['bookings', '*, staff:profiles!bookings_staff_id_fkey(full_name)'],
    ['bookings', '*, staff:profiles!fk_bookings_staff_id(full_name)'],
    ['payments', '*, bookings!payments_booking_id_fkey(*)'],
    ['payments', '*, bookings!fk_payments_booking_id(*)'],
    ['audit_logs', '*, profiles!audit_logs_actor_id_fkey(full_name)'],
    ['audit_logs', '*, profiles!fk_audit_logs_actor_id(full_name)'],
  ];

  for (const [table, select] of tests) {
    const { error: e } = await s.from(table).select(select).limit(0);
    console.log(`${table} -> ${select.substring(0, 60)}... : ${e ? 'FAIL' : 'OK'}`);
  }
}
run();

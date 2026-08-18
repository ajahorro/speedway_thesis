const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStaffAccess() {
  const { data: staffProfiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'STAFF');

  if (!staffProfiles || staffProfiles.length === 0) return;

  const staff = staffProfiles[0];
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXl0eGxhaWRtbmR0cXhjdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjMyOTQsImV4cCI6MjA5MzgzOTI5NH0.WCVwWggTiCw4-BZBVSSxDw4vcofJ8Jtn059lXAJDRDc'
  );

  const { data: signInData } = await anonClient.auth.signInWithPassword({
    email: staff.email,
    password: 'staff123'
  });

  const staffClient = createClient(
    process.env.SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXl0eGxhaWRtbmR0cXhjdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjMyOTQsImV4cCI6MjA5MzgzOTI5NH0.WCVwWggTiCw4-BZBVSSxDw4vcofJ8Jtn059lXAJDRDc',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } }
    }
  );

  // Test StaffJobDetails query
  const { data, error } = await staffClient
    .from('booking_vehicles')
    .select(`
      *,
      booking:bookings(id, start_datetime, end_datetime, status, staff_id),
      services:booking_vehicle_services(*)
    `);
  
  if (error) {
    console.log('Query failed:', error.message);
  } else {
    console.log('Query succeeded! Returned units:', data.length);
  }
}

checkStaffAccess();

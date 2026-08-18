require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing RLS policies on blocked_slots...');
  
  // 1. Check existing policies on blocked_slots via pg_policies table or raw SQL via rpc
  const { data: policies, error: polErr } = await supabaseAdmin
    .from('blocked_slots')
    .select('*')
    .limit(1);

  console.log('Admin query blocked_slots:', policies, polErr);

  // Test executing SQL via pg_catalog query or service role
  // Let's check if we can enable RLS policies on blocked_slots for admin
}

run();

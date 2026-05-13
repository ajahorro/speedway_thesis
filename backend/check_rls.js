const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'b683af80-8607-42d7-a27d-ba0e788c91d1')
    .single();
  
  if (pError) {
    console.error('Profile Error:', pError);
  } else {
    console.log('Profile:', JSON.stringify(profile, null, 2));
  }

  const { data: policies, error: polError } = await supabase
    .rpc('get_policies', { table_name: 'vehicles' });
  
  if (polError) {
    console.warn('Could not fetch policies via RPC, trying direct query...');
    // Fallback: try to see if we can query pg_policies
    const { data: pgPol, error: pgError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'vehicles');
    console.log('Policies:', JSON.stringify(pgPol || pgError, null, 2));
  } else {
    console.log('Policies:', JSON.stringify(policies, null, 2));
  }
}

check();

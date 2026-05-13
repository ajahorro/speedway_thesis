const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { count: c1 } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
  const { count: c2 } = await supabase.from('user_vehicles').select('*', { count: 'exact', head: true });
  
  console.log('vehicles:', c1);
  console.log('user_vehicles:', c2);
}

check();

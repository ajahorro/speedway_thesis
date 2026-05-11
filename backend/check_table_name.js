
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .limit(1);
    
  if (error) {
    console.log('Table "profiles" error:', error.message);
    const { data: d2, error: e2 } = await supabase.from('Profiles').select('role').limit(1);
    if (e2) console.log('Table "Profiles" error:', e2.message);
    else console.log('Table is "Profiles" (Capitalized)');
  } else {
    console.log('Table is "profiles" (Lowercase)');
  }
}

check();

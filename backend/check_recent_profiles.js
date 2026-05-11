
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);
    
  console.log('Recent Profiles:');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

check();

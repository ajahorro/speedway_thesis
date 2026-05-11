
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const email = 'marymopee@gmail.com';
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email);
    
  console.log('Profile for ' + email + ':');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

check();

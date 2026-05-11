
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Recent Invites:');
  console.log(JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

check();

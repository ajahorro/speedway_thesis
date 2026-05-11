
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const email = 'marymopee@gmail.com';
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);
  
  if (user) {
    console.log('Auth User Data for ' + email + ':');
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log('User not found in Auth for ' + email);
  }
}

check();

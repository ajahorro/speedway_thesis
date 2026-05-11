
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  console.log('All Auth Users:');
  users.forEach(u => {
    console.log(`- ${u.email} [${u.id}] Meta:`, JSON.stringify(u.user_metadata));
  });
}

check();

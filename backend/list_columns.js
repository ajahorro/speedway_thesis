
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);



async function checkTable(tableName) {
  console.log(`\n--- Table: ${tableName} ---`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)
    .maybeSingle();
    
  if (error) {
    console.error(`Error fetching ${tableName}:`, error.message);
    return;
  }
  
  if (!data) {
    console.log(`No records found in ${tableName}.`);
    return;
  }
  
  console.log(`Columns: ${Object.keys(data).join(', ')}`);
}


async function run() {
  await checkTable('bookings');
  await checkTable('payments');
  await checkTable('audit_logs');
  await checkTable('user_vehicles');
  await checkTable('vehicles');
  await checkTable('profiles');
}

run();


const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../frontend/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  console.log('--- DATABASE INSPECTION ---');
  
  const { data: bookings } = await supabase.from('bookings').select('id, customer_name, status, created_at, start_datetime').limit(5);
  console.log('Bookings Found:', bookings?.length || 0);
  if (bookings?.length) console.table(bookings);

  const { data: payments } = await supabase.from('payments').select('id, booking_id, status, amount, method, receipt_url').limit(5);
  console.log('Payments Found:', payments?.length || 0);
  if (payments?.length) console.table(payments);

  const { data: audit } = await supabase.from('audit_logs').select('id, action_type, details').limit(5);
  console.log('Audit Logs Found:', audit?.length || 0);
  
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Storage Buckets:', buckets?.map(b => b.name).join(', '));
}

inspect();

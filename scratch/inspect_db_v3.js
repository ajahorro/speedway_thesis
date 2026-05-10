
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../frontend/.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  console.log('--- DATABASE INSPECTION ---');
  
  try {
    const { data: bookings, error: bError } = await supabase.from('bookings').select('id, customer_name, status, created_at, start_datetime').order('created_at', { ascending: false }).limit(5);
    console.log('Bookings Found:', bookings?.length || 0);
    if (bError) console.error('Booking Error:', bError);
    if (bookings?.length) console.table(bookings);

    const { data: payments, error: pError } = await supabase.from('payments').select('id, booking_id, status, amount, method, receipt_url').order('created_at', { ascending: false }).limit(5);
    console.log('Payments Found:', payments?.length || 0);
    if (pError) console.error('Payment Error:', pError);
    if (payments?.length) console.table(payments);

    const { data: audit, error: aError } = await supabase.from('audit_logs').select('id, action_type, details').limit(5);
    console.log('Audit Logs Found:', audit?.length || 0);
    if (aError) console.error('Audit Error:', aError);

    const { data: buckets, error: sError } = await supabase.storage.listBuckets();
    console.log('Storage Buckets:', buckets?.map(b => b.name).join(', '));
    if (sError) console.error('Storage Error:', sError);

  } catch (e) {
    console.error('Fatal Error:', e);
  }
}

inspect();

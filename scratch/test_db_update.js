
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: './backend/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function testUpdate() {
  const userId = '0929f0e1-4ba2-40a8-b64f-4d941865a9e3'; // Assuming this is John Doe's ID from previous logs
  
  console.log('Fetching current status...');
  let { data: p1 } = await supabase.from('profiles').select('is_clocked_in').eq('id', userId).single();
  console.log('Current:', p1.is_clocked_in);

  const target = !p1.is_clocked_in;
  console.log('Updating to:', target);
  
  const { error: uErr } = await supabase.from('profiles').update({ is_clocked_in: target }).eq('id', userId);
  if (uErr) console.error('Update Error:', uErr);

  console.log('Fetching again...');
  let { data: p2 } = await supabase.from('profiles').select('is_clocked_in').eq('id', userId).single();
  console.log('New status in DB:', p2.is_clocked_in);
}

testUpdate()

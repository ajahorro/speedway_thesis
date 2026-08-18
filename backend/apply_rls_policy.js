require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing RPC or SQL execution...');
  // Check if we can create an RPC to execute SQL or apply policy directly
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: `
    ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.blocked_slots;
    CREATE POLICY "Allow full access for authenticated users" ON public.blocked_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow read access for all users" ON public.blocked_slots;
    CREATE POLICY "Allow read access for all users" ON public.blocked_slots FOR SELECT TO public USING (true);
  `});

  console.log('RPC exec_sql result:', data, error);
}

run();

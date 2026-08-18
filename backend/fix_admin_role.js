const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('\n🔧 Fixing admin@speedway.com — restoring ADMIN role...');

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'ADMIN', is_active: true, deactivated_at: null })
    .eq('email', 'admin@speedway.com');

  if (error) {
    console.error('❌ Failed:', error.message);
  } else {
    console.log('✅ admin@speedway.com restored to ADMIN role successfully.');
  }

  // Verify
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, role, full_name, is_active')
    .eq('email', 'admin@speedway.com')
    .single();

  console.log('\nVerification:', data);
  console.log('\n✅ Done.\n');
}

fix();

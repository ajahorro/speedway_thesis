
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- AUDITING ADMIN ROLES ---');
  
  // 1. Get all profiles with role ADMIN
  const { data: admins, error: aError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'ADMIN');
    
  if (aError) return console.error(aError);

  for (const admin of admins) {
    // 2. Look for an invite for this email
    const { data: invite } = await supabase
      .from('invites')
      .select('*')
      .eq('email', admin.email)
      .single();
      
    if (invite) {
      console.log(`User: ${admin.email}`);
      console.log(`  Profile Role: ${admin.role}`);
      console.log(`  Invite Role:  ${invite.role}`);
      if (admin.role !== invite.role) {
        console.log('  ⚠️ ROLE MISMATCH DETECTED!');
      }
      console.log('---');
    }
  }
}

check();

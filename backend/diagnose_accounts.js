const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Service role - bypasses RLS (source of truth)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('\n========== ACCOUNT DIAGNOSTIC ==========\n');

  // 1. All auth users
  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error('Auth list error:', authErr.message);
  } else {
    console.log(`AUTH USERS (${authUsers.users.length} total):`);
    authUsers.users.forEach(u => {
      console.log(`  [${u.id.slice(0,8)}]  ${u.email}  confirmed=${u.email_confirmed_at ? 'YES' : 'NO'}`);
    });
  }

  console.log('');

  // 2. All profiles (service role - sees everything)
  const { data: allProfiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, full_name, is_active')
    .order('role');

  if (profErr) {
    console.error('Profile fetch error:', profErr.message);
  } else {
    console.log(`PROFILES TABLE (${allProfiles.length} total, service role):`);
    allProfiles.forEach(p => {
      console.log(`  [${p.id.slice(0,8)}]  ${p.email?.padEnd(35)}  role=${p.role?.padEnd(10)}  active=${p.is_active}  name="${p.full_name}"`);
    });
  }

  console.log('');

  // 3. Check if auth users have matching profiles
  console.log('AUTH <-> PROFILE SYNC CHECK:');
  if (authUsers?.users && allProfiles) {
    for (const u of authUsers.users) {
      const profile = allProfiles.find(p => p.id === u.id);
      if (!profile) {
        console.log(`  ❌ NO PROFILE:  ${u.email}  (auth id: ${u.id})`);
      } else {
        console.log(`  ✅ SYNCED:      ${u.email}  role=${profile.role}  active=${profile.is_active}`);
      }
    }
  }

  console.log('\n========================================\n');
}

diagnose();

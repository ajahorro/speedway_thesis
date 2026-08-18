const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createDefaultAdmin() {
  const email = 'testadmin961@gmail.com';
  const password = 'admin123';

  console.log(`\n🔧 Creating Default Admin account: ${email}`);

  // Step 1: Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Skip email confirmation
  });

  if (authError) {
    console.error('❌ Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Auth user created. ID: ${userId}`);

  // Step 2: Upsert profile with ADMIN role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      role: 'ADMIN',
      first_name: 'Default',
      last_name: 'Admin',
      full_name: 'Default Admin',
      is_active: true,
      deactivated_at: null
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌ Failed to upsert profile:', profileError.message);
    process.exit(1);
  }

  console.log(`✅ Profile created with role ADMIN`);
  console.log(`\n🎉 Default Admin account ready!`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     ADMIN\n`);
}

createDefaultAdmin();

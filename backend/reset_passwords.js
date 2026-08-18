const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🛡️ DEFAULT ADMIN is excluded — never touched.
const DEFAULT_ADMIN_ID = '3057c70b-7eec-4445-9a1b-68118f9c6bd0'; // testadmin961@gmail.com

const RESETS = [
  { id: '8bf5cff9-443d-4b7c-99c4-df6705e7bb5c', email: 'admin@speedway.com',    password: 'admin123',    label: 'Regular Admin' },
  { id: 'bf817bde-633d-4b71-b16b-1686d877f46c', email: 'customer@gmail.com',    password: 'customer123', label: 'Customer'       },
  { id: '32ab544d-4d38-452a-909f-0fe95c5fa0be', email: 'staff1@speedway.com',   password: 'staff123',    label: 'Staff 1'        },
  { id: '6baaf326-9774-4bcc-b3ab-b7ec27e13dd3', email: 'staff2@speedway.com',   password: 'staff123',    label: 'Staff 2'        },
];

async function resetPasswords() {
  console.log('\n========== PASSWORD RESET ==========\n');
  console.log(`🛡️  Skipping Default Admin (testadmin961@gmail.com) — untouched.\n`);

  for (const account of RESETS) {
    // Safety: skip default admin if it ever ends up in the list
    if (account.id === DEFAULT_ADMIN_ID) {
      console.log(`⛔ SKIPPED (default admin guard): ${account.email}`);
      continue;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(account.id, {
      password: account.password
    });

    if (error) {
      console.error(`❌ FAILED  [${account.label}] ${account.email}: ${error.message}`);
    } else {
      console.log(`✅ RESET   [${account.label}] ${account.email}  →  password: ${account.password}`);
    }
  }

  console.log('\n====================================');
  console.log('\n📋 FINAL CREDENTIALS SUMMARY:\n');
  console.log('  testadmin961@gmail.com  →  admin123      (Default Admin — unchanged)');
  console.log('  admin@speedway.com      →  admin123');
  console.log('  customer@gmail.com      →  customer123');
  console.log('  staff1@speedway.com     →  staff123');
  console.log('  staff2@speedway.com     →  staff123');
  console.log('');
}

resetPasswords();

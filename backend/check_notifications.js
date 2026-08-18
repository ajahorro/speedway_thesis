const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkNotifications() {
  console.log('\n========== NOTIFICATIONS DATABASE STATUS ==========\n');

  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return;
  }

  console.log(`Total notifications in database: ${notifs.length}`);
  if (notifs.length > 0) {
    console.log('Recent 10 notifications:');
    notifs.slice(0, 10).forEach(n => {
      console.log(`  [${n.id}] UserID=${n.user_id?.slice(0,8)} type=${n.notification_type} msg="${n.message}"`);
    });
  }

  const { data: audit, error: ae } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`\nTotal audit logs in database: ${audit?.length || 0}`);
  if (audit && audit.length > 0) {
    console.log('Recent 5 audit logs:');
    audit.slice(0, 5).forEach(a => {
      console.log(`  [${a.id}] action=${a.action_type} actor=${a.actor_name} details="${a.details}"`);
    });
  }

  console.log('\n====================================================\n');
}

checkNotifications();

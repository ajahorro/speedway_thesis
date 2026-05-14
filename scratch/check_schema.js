
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: './backend/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function checkSchema() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error fetching profiles:', error)
  } else {
    console.log('Profile columns:', Object.keys(data[0] || {}))
  }
}

checkSchema()

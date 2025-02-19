import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { HealthMonitor } from '../services/healthMonitor';

// Load environment variables
dotenv.config({ path: '.env' });

async function verifySupabaseConnection() {
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  
  console.log('Checking Supabase configuration...');
  console.log('URL:', SUPABASE_URL ? '✓ Set' : '✗ Missing');
  console.log('Key:', SUPABASE_KEY ? '✓ Set' : '✗ Missing');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing required Supabase configuration');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const healthMonitor = new HealthMonitor(supabase, null);
  
  try {
    console.log('Verifying Supabase connection...');
    
    const dbResult = await healthMonitor.checkDatabase();
    console.log('Database connection:', dbResult ? '✅ Connected' : '❌ Failed');
    
    const storageResult = await healthMonitor.checkStorage();
    console.log('Storage connection:', storageResult ? '✅ Connected' : '❌ Failed');
    
    if (dbResult && storageResult) {
      console.log('\nSupabase connection verified successfully! ✨');
      return true;
    } else {
      console.error('\nSupabase connection verification failed.');
      return false;
    }
  } catch (error) {
    console.error('Error verifying Supabase connection:', error);
    return false;
  }
}

// Run verification
verifySupabaseConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
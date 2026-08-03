import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tlyhzrridqtbplfozner.supabase.co';
const anonKey = 'sb_publishable_8pClLd0SyBhdiAFaSZF9lw_tLDjMetU';
const supabase = createClient(supabaseUrl, anonKey);

async function checkStorage() {
  try {
    console.log('Listing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;
    console.log('Buckets:', buckets);
    
    console.log('Attempting to create bucket "restaurant-photos"...');
    const { data: newBucket, error: createError } = await supabase.storage.createBucket('restaurant-photos', {
      public: true
    });
    if (createError) {
      console.log('Create Bucket failed (probably lacks permissions):', createError.message);
    } else {
      console.log('Create Bucket succeeded:', newBucket);
    }
  } catch (err) {
    console.error('Storage test error:', err);
  }
}

checkStorage();

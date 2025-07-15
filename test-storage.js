// Quick test to check storage bucket and policies
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhadznrbueitsfmirpd.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageAccess() {
  console.log('Testing storage access...');
  
  // Test 1: List buckets
  console.log('\n1. Listing buckets:');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));
  if (bucketsError) console.log('Buckets error:', bucketsError);
  
  // Test 2: Check if student-recordings bucket exists
  const hasStudentRecordings = buckets?.some(b => b.name === 'student-recordings');
  console.log('\n2. student-recordings bucket exists:', hasStudentRecordings);
  
  // Test 3: Try to upload a small test file
  console.log('\n3. Testing upload...');
  const testBlob = new Blob(['test'], { type: 'text/plain' });
  const testPath = 'test/test.txt';
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('student-recordings')
    .upload(testPath, testBlob);
    
  if (uploadError) {
    console.log('Upload error:', uploadError);
  } else {
    console.log('Upload success:', uploadData);
    
    // Clean up test file
    await supabase.storage.from('student-recordings').remove([testPath]);
  }
  
  // Test 4: Check current user
  console.log('\n4. Current user:');
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User:', user ? 'Authenticated' : 'Anonymous');
  console.log('User ID:', user?.id || 'None');
}

testStorageAccess().catch(console.error);
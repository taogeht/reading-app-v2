import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createAssignmentRPC() {
  console.log('🔧 Creating Assignment RPC Function for Student Access\n');

  // We'll create the RPC function by calling it (which will trigger creation)
  // First let's test if it already exists
  
  try {
    console.log('🧪 Testing if RPC function already exists...');
    const { data: testResult, error: testError } = await supabase
      .rpc('get_published_assignments_for_class', {
        class_id_param: '32819745-adee-42df-b2c1-be4fc8bb7c93'
      });

    if (testError) {
      console.log('❌ RPC function does not exist yet:', testError.message);
      console.log('   We need to create it via the Supabase SQL editor');
    } else {
      console.log('✅ RPC function exists and works!');
      console.log(`   Returned ${testResult.length} assignments`);
      return;
    }

    // The function doesn't exist, so let's provide instructions
    console.log('\n📝 INSTRUCTIONS: Please run this SQL in your Supabase SQL Editor:');
    console.log('=' .repeat(80));
    
    const sqlFunction = `
-- Create RPC function for students to access assignments (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_published_assignments_for_class(class_id_param UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  story_id TEXT,
  story_title TEXT,
  class_id UUID,
  due_date TIMESTAMPTZ,
  instructions TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.story_id,
    a.story_title,
    a.class_id,
    a.due_date,
    a.instructions
  FROM public.assignments a
  WHERE a.class_id = class_id_param
    AND a.is_published = true
  ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_published_assignments_for_class TO anon;
GRANT EXECUTE ON FUNCTION public.get_published_assignments_for_class TO authenticated;

-- Test the function
SELECT * FROM public.get_published_assignments_for_class('32819745-adee-42df-b2c1-be4fc8bb7c93');
`;

    console.log(sqlFunction);
    console.log('=' .repeat(80));
    
    // Let's also try a simpler approach - updating the existing assignment service
    console.log('\n🔄 Alternative: I will update the StudentAssignments component to work around this issue');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAssignmentRPC();
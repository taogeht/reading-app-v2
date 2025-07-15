# Database Setup Instructions

This document explains how to set up the PostgreSQL database schema for the Reading Practice Platform using Supabase.

## Prerequisites

- A Supabase project created at [supabase.com](https://supabase.com)
- Admin access to your Supabase project
- The Supabase URL and anon key added to your `.env` file

## Setup Steps

### 1. Run the Initial Schema Migration

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `001_initial_schema.sql`
4. Execute the SQL script

**Important**: 
- The script handles circular dependencies by creating tables first, then adding foreign key constraints
- The script is **idempotent** - it can be run multiple times safely
- If you get errors about existing constraints/triggers, the script will handle them gracefully
- Run `000_verify_schema.sql` first to see what already exists in your database

This will create:
- All required tables (`profiles`, `classes`, `assignments`, `recordings`)
- Proper foreign key relationships and constraints
- Indexes for performance optimization
- Row Level Security (RLS) policies
- Triggers for automatic timestamps
- Storage bucket setup (commented out)

### 2. Verify the Schema

After running the migration, verify that the following tables exist:

- `public.profiles` - User profiles with roles
- `public.classes` - Class/classroom management
- `public.assignments` - Reading assignments
- `public.recordings` - Student audio submissions

### 3. Set Up Storage Bucket

The schema includes automatic storage bucket setup. The script will:

1. Create a bucket called `recordings` (or skip if it already exists)
2. Set up proper access policies for students, teachers, and admins
3. Enable Row Level Security on storage objects

**If you get bucket creation errors**: The bucket might already exist. The script uses `ON CONFLICT DO NOTHING` to handle this gracefully.

**Alternative**: You can run `003_storage_setup.sql` separately if you prefer to set up storage independently.

### 4. Test User Creation

The schema includes automatic profile creation when users sign up through Supabase Auth. Test this by:

1. Creating a test user account through your app
2. Verifying a profile record is automatically created
3. Checking that the user can access appropriate data based on their role

## Database Schema Overview

### Tables and Relationships

```
auth.users (Supabase managed)
    ↓ (1:1)
profiles
    ↓ (1:many)
classes ← teacher_id
    ↓ (1:many)
assignments
    ↓ (1:many)
recordings ← student_id (profiles)
```

### Key Features

- **UUID Primary Keys**: All tables use UUIDs for better security and scalability
- **Row Level Security**: Users can only access data they have permission to see
- **Automatic Timestamps**: `created_at` and `updated_at` fields are managed automatically
- **Soft Deletes**: Classes use `is_active` flag instead of hard deletion
- **Attempt Tracking**: Recordings track multiple attempts per assignment
- **Status Workflow**: Recordings progress through uploaded → processing → completed/failed

### User Roles

- **Student**: Can view assignments for their class and submit recordings
- **Teacher**: Can manage their classes and assignments, view student recordings
- **Admin**: Can access all data across the platform

## Environment Variables

Ensure these are set in your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Security Notes

- All tables have Row Level Security enabled
- Storage bucket should be private with proper access policies
- API keys should never be committed to version control
- Production environments should use service role keys for server-side operations

## Troubleshooting

### Common Issues

1. **"relation does not exist" errors**: 
   - Make sure to run the entire `001_initial_schema.sql` script at once
   - The script creates tables first, then adds foreign key constraints to handle circular dependencies

2. **"constraint already exists" errors**:
   - The script is idempotent and handles existing objects gracefully
   - Use `000_verify_schema.sql` to check what already exists
   - Re-running the script should not cause issues

3. **Foreign Key Constraint Errors**: Make sure parent records exist before creating child records

4. **RLS Policy Denials**: Check that the user has the correct role and permissions

5. **Storage Upload Failures**: Verify storage bucket exists and policies are correct

### Helpful Queries

Check if all tables were created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'classes', 'assignments', 'recordings');
```

Check user profile:
```sql
SELECT * FROM profiles WHERE id = auth.uid();
```

View all classes for current user:
```sql
SELECT * FROM classes WHERE teacher_id = auth.uid();
```

Check recording status:
```sql
SELECT status, count(*) FROM recordings GROUP BY status;
```

### Testing the Schema

You can use `002_test_data.sql` to add sample data for testing, but you'll need to:
1. Create test users through your app's signup process first
2. Replace the placeholder UUIDs with actual user/class IDs
3. Uncomment and modify the INSERT statements as needed

## Migration History

- `001_initial_schema.sql` - Initial database schema with all tables, indexes, policies, and storage setup
- `002_test_data.sql` - Optional sample data for testing (requires manual UUID replacement)
- `003_storage_setup.sql` - Standalone storage bucket and policy setup (alternative to main schema)

## File Structure

```
database/
├── 000_verify_schema.sql     # Check what already exists
├── 001_initial_schema.sql    # Main schema - run this first
├── 002_test_data.sql         # Optional test data
├── 003_storage_setup.sql     # Alternative storage setup
└── README.md                 # This documentation
```

## Quick Start

1. **Check existing objects**: Run `000_verify_schema.sql` to see what's already in your database
2. **Create schema**: Run `001_initial_schema.sql` to create all tables, constraints, and policies
3. **Verify setup**: Run `000_verify_schema.sql` again to confirm everything was created
4. **Test with data**: Optionally use `002_test_data.sql` for sample data
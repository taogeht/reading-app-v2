// Migration runner for Railway database
// Applies BetterAuth tables and visual password setup

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Read the BetterAuth migration file
    const migrationPath = join(__dirname, '../railway-migration/002_betterauth_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Applying BetterAuth tables migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Test the connection
    const result = await client.query('SELECT COUNT(*) as visual_password_count FROM visual_passwords');
    console.log(`📊 Visual passwords available: ${result.rows[0].visual_password_count}`);
    
    // Check if profiles table has visual_password_id column
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'visual_password_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Profiles table updated with visual_password_id column');
    }
    
    // Check if classes table has access_token column
    const classColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'classes' AND column_name = 'access_token'
    `);
    
    if (classColumnCheck.rows.length > 0) {
      console.log('✅ Classes table updated with access_token column');
    }
    
    console.log('🎉 Database is ready for unified authentication!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
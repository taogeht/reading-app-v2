import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration for Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Connected to Railway PostgreSQL:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Railway PostgreSQL:', error.message);
    return false;
  }
}

async function runSQLFile(filePath) {
  try {
    console.log(`📋 Running SQL file: ${path.basename(filePath)}`);
    
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const client = await pool.connect();
    
    try {
      await client.query(sqlContent);
      console.log(`✅ Successfully executed: ${path.basename(filePath)}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Error executing ${path.basename(filePath)}:`, error.message);
    throw error;
  }
}

async function importDatabase() {
  console.log('🚀 Starting Railway database import...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot proceed without database connection');
    process.exit(1);
  }
  
  const migrationDir = path.join(process.cwd(), 'railway-migration');
  
  // Check if migration files exist
  const schemaFile = path.join(migrationDir, '001_initial_schema.sql');
  
  if (!fs.existsSync(schemaFile)) {
    console.error('❌ Schema file not found:', schemaFile);
    console.log('Please ensure the railway-migration directory contains the schema file.');
    process.exit(1);
  }
  
  try {
    // Import schema
    console.log('📋 Importing database schema...');
    await runSQLFile(schemaFile);
    
    // Check if data file exists and import it
    const dataFile = path.join(migrationDir, 'data.sql');
    if (fs.existsSync(dataFile)) {
      console.log('📊 Importing data...');
      await runSQLFile(dataFile);
    } else {
      console.log('ℹ️  No data file found, skipping data import');
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      
      console.log('📋 Tables created:');
      result.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
      
      // Check row counts
      console.log('\n📊 Table row counts:');
      const tables = ['profiles', 'classes', 'assignments', 'recordings'];
      
      for (const table of tables) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`   📋 ${table}: ${countResult.rows[0].count} rows`);
        } catch (error) {
          console.log(`   ⚠️  ${table}: Error counting rows (table may not exist)`);
        }
      }
      
    } finally {
      client.release();
    }
    
    console.log('\n✅ Database import completed successfully!');
    console.log('🎉 Railway PostgreSQL database is ready for the reading app');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    await importDatabase();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
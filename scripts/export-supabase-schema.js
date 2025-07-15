import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to export table schema
async function exportTableSchema(tableName) {
  try {
    console.log(`📋 Exporting schema for table: ${tableName}`);
    
    // Get table structure from information_schema
    const { data: columns, error } = await supabase
      .rpc('get_table_schema', { table_name: tableName });
    
    if (error) {
      console.error(`Error getting schema for ${tableName}:`, error);
      return null;
    }
    
    return columns;
  } catch (error) {
    console.error(`Failed to export schema for ${tableName}:`, error);
    return null;
  }
}

// Function to export table data
async function exportTableData(tableName) {
  try {
    console.log(`📊 Exporting data from table: ${tableName}`);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error(`Error exporting data from ${tableName}:`, error);
      return [];
    }
    
    console.log(`   ✅ Exported ${data?.length || 0} rows from ${tableName}`);
    return data || [];
  } catch (error) {
    console.error(`Failed to export data from ${tableName}:`, error);
    return [];
  }
}

// Function to generate CREATE TABLE SQL
function generateCreateTableSQL(tableName, schema) {
  // This is a simplified version - you may need to adjust based on actual schema
  let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  
  // Add basic columns (adjust based on your actual schema)
  const baseColumns = [
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
    'updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
  ];
  
  // Table-specific columns
  const tableColumns = {
    profiles: [
      'email TEXT UNIQUE NOT NULL',
      'username TEXT UNIQUE',
      'full_name TEXT',
      'role TEXT NOT NULL CHECK (role IN (\'student\', \'teacher\', \'admin\'))',
      'class_id UUID REFERENCES classes(id)'
    ],
    classes: [
      'name TEXT NOT NULL',
      'grade_level INTEGER NOT NULL',
      'teacher_id UUID NOT NULL REFERENCES profiles(id)',
      'school_year TEXT',
      'description TEXT',
      'is_active BOOLEAN DEFAULT true'
    ],
    assignments: [
      'title TEXT NOT NULL',
      'description TEXT',
      'story_id TEXT NOT NULL',
      'story_title TEXT NOT NULL',
      'class_id UUID NOT NULL REFERENCES classes(id)',
      'teacher_id UUID NOT NULL REFERENCES profiles(id)',
      'due_date TIMESTAMP WITH TIME ZONE',
      'instructions TEXT',
      'max_attempts INTEGER DEFAULT 3',
      'is_published BOOLEAN DEFAULT false'
    ],
    recordings: [
      'student_id UUID NOT NULL REFERENCES profiles(id)',
      'assignment_id UUID NOT NULL REFERENCES assignments(id)',
      'attempt_number INTEGER DEFAULT 1',
      'audio_url TEXT NOT NULL',
      'audio_filename TEXT NOT NULL',
      'audio_size_bytes BIGINT',
      'audio_duration_seconds NUMERIC',
      'transcript TEXT',
      'feedback_data JSONB',
      'accuracy_score NUMERIC',
      'reading_pace TEXT CHECK (reading_pace IN (\'too-fast\', \'just-right\', \'too-slow\'))',
      'word_count INTEGER',
      'correct_words INTEGER',
      'status TEXT DEFAULT \'uploaded\' CHECK (status IN (\'uploaded\', \'processing\', \'completed\', \'failed\'))',
      'processing_started_at TIMESTAMP WITH TIME ZONE',
      'processing_completed_at TIMESTAMP WITH TIME ZONE',
      'error_message TEXT',
      'submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
    ]
  };
  
  const columns = [...baseColumns, ...(tableColumns[tableName] || [])];
  sql += '  ' + columns.join(',\n  ') + '\n';
  sql += ');';
  
  return sql;
}

// Function to generate INSERT SQL
function generateInsertSQL(tableName, data) {
  if (!data || data.length === 0) {
    return `-- No data to insert for ${tableName}\n`;
  }
  
  const columns = Object.keys(data[0]);
  let sql = `-- Insert data for ${tableName}\n`;
  
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) {
        return 'NULL';
      }
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`;
      }
      if (typeof value === 'object') {
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      }
      return value;
    });
    
    sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
  }
  
  return sql + '\n';
}

// Main export function
async function exportDatabase() {
  console.log('🚀 Starting Supabase database export...\n');
  
  const tables = ['profiles', 'classes', 'assignments', 'recordings'];
  const outputDir = path.join(process.cwd(), 'railway-migration');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let schemaSQL = '-- Railway Migration Schema\n';
  schemaSQL += '-- Generated from Supabase database\n';
  schemaSQL += `-- Export Date: ${new Date().toISOString()}\n\n`;
  
  // Enable UUID extension
  schemaSQL += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n';
  schemaSQL += 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n';
  
  let dataSQL = '-- Railway Migration Data\n';
  dataSQL += `-- Generated from Supabase database\n`;
  dataSQL += `-- Export Date: ${new Date().toISOString()}\n\n`;
  
  const exportSummary = {
    export_date: new Date().toISOString(),
    tables: {},
    total_rows: 0
  };
  
  // Export each table
  for (const tableName of tables) {
    console.log(`\n📋 Processing table: ${tableName}`);
    
    // Generate schema
    schemaSQL += `-- ${tableName.toUpperCase()} TABLE\n`;
    schemaSQL += generateCreateTableSQL(tableName) + '\n\n';
    
    // Export data
    const data = await exportTableData(tableName);
    dataSQL += generateInsertSQL(tableName, data);
    
    exportSummary.tables[tableName] = {
      row_count: data.length,
      columns: data.length > 0 ? Object.keys(data[0]) : []
    };
    exportSummary.total_rows += data.length;
    
    // Save individual table data as JSON for backup
    fs.writeFileSync(
      path.join(outputDir, `${tableName}_data.json`),
      JSON.stringify(data, null, 2)
    );
  }
  
  // Save schema and data SQL files
  fs.writeFileSync(path.join(outputDir, 'schema.sql'), schemaSQL);
  fs.writeFileSync(path.join(outputDir, 'data.sql'), dataSQL);
  
  // Save export summary
  fs.writeFileSync(
    path.join(outputDir, 'export_summary.json'),
    JSON.stringify(exportSummary, null, 2)
  );
  
  console.log('\n✅ Export completed successfully!');
  console.log(`📁 Files saved to: ${outputDir}`);
  console.log(`📊 Total rows exported: ${exportSummary.total_rows}`);
  console.log('\nFiles created:');
  console.log('  - schema.sql (table definitions)');
  console.log('  - data.sql (insert statements)');
  console.log('  - export_summary.json (export metadata)');
  console.log('  - *_data.json (individual table backups)');
}

// Check database connection and run export
async function main() {
  try {
    // Test connection
    const { data, error } = await supabase.from('profiles').select('count').single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Failed to connect to Supabase:', error);
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully');
    await exportDatabase();
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

main();
#!/usr/bin/env node
/**
 * Generate BetterAuth Admin Account
 * This script creates a complete admin account with proper password hashing
 * Compatible with BetterAuth's scrypt-based password system
 */

import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

// Configuration - UPDATE THESE VALUES
const ADMIN_CONFIG = {
  email: 'bryce@mschool.com.tw',           // 🔄 CHANGE THIS
  name: 'System Administrator',             // 🔄 CHANGE THIS  
  username: 'brycev',                        // 🔄 CHANGE THIS
  password: 'password',     // 🔄 CHANGE THIS
};

/**
 * Hash password using BetterAuth-compatible scrypt
 * This matches BetterAuth's default hashing algorithm
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Generate UUIDs for database records
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Generate SQL script to create complete admin account
 */
async function generateAdminSQL() {
  const userId = generateId();
  const profileId = generateId();
  const accountId = generateId();
  const hashedPassword = await hashPassword(ADMIN_CONFIG.password);
  const timestamp = new Date().toISOString();

  const sql = `
-- Generated Admin Account Creation Script
-- Created: ${timestamp}
-- Email: ${ADMIN_CONFIG.email}

-- Clean up any existing records (optional - remove if you want to keep existing data)
DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE email = '${ADMIN_CONFIG.email}');
DELETE FROM profiles WHERE email = '${ADMIN_CONFIG.email}';  
DELETE FROM "user" WHERE email = '${ADMIN_CONFIG.email}';

-- Create BetterAuth user record
INSERT INTO "user" (
    id,
    email,
    name,
    username,
    role,
    email_verified,
    created_at,
    updated_at
) VALUES (
    '${userId}',
    '${ADMIN_CONFIG.email}',
    '${ADMIN_CONFIG.name}',
    '${ADMIN_CONFIG.username}',
    'admin',
    true,
    NOW(),
    NOW()
);

-- Create BetterAuth account record with hashed password
INSERT INTO account (
    id,
    user_id,
    account_id,
    provider,
    password,
    created_at,
    updated_at
) VALUES (
    '${accountId}',
    '${userId}',
    '${ADMIN_CONFIG.email}',
    'credential',
    '${hashedPassword}',
    NOW(),
    NOW()
);

-- Create profiles record (your app-specific user data)
INSERT INTO profiles (
    id,
    email,
    username,
    full_name,
    role,
    created_at,
    updated_at
) VALUES (
    '${profileId}',
    '${ADMIN_CONFIG.email}',
    '${ADMIN_CONFIG.username}',
    '${ADMIN_CONFIG.name}',
    'admin',
    NOW(),
    NOW()
);

-- Verify the account was created successfully
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.role as user_role,
    a.provider,
    CASE WHEN a.password IS NOT NULL THEN 'Password Set ✅' ELSE 'No Password ❌' END as password_status,
    p.role as profile_role
FROM "user" u
LEFT JOIN account a ON u.id = a.user_id  
LEFT JOIN profiles p ON u.email = p.email
WHERE u.email = '${ADMIN_CONFIG.email}';

-- Success message
SELECT '🎉 Admin account created successfully! You can now login with:' as status;
SELECT 'Email: ${ADMIN_CONFIG.email}' as login_email;
SELECT 'Password: [your-configured-password]' as login_password;
SELECT 'Access: https://your-app.com/teacher (then navigate to /admin)' as access_url;
`;

  return sql;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔐 Generating BetterAuth Admin Account...\n');
    
    console.log('📋 Configuration:');
    console.log(`   Email: ${ADMIN_CONFIG.email}`);
    console.log(`   Name: ${ADMIN_CONFIG.name}`);
    console.log(`   Username: ${ADMIN_CONFIG.username}`);
    console.log(`   Password: ${'*'.repeat(ADMIN_CONFIG.password.length)}\n`);

    const sql = await generateAdminSQL();
    
    // Write SQL to file
    const fs = await import('fs/promises');
    const filename = 'railway-migration/create_admin_account.sql';
    await fs.writeFile(filename, sql);
    
    console.log('✅ Admin account SQL generated successfully!');
    console.log(`📄 File saved: ${filename}`);
    console.log('\n🚀 Next steps:');
    console.log('1. Review the SQL file to ensure your details are correct');
    console.log('2. Run: railway login && railway link');
    console.log('3. Run: railway run psql $DATABASE_URL -f railway-migration/create_admin_account.sql');
    console.log('4. Test login at your app\'s /teacher route');
    console.log('5. Navigate to /admin to access admin dashboard\n');
    
  } catch (error) {
    console.error('❌ Error generating admin account:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { hashPassword, generateAdminSQL };
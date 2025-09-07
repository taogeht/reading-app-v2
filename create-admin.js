// Create admin account with hashed password
// Run with: node create-admin.js

import { DatabaseService } from './src/lib/database-service.js';

async function createAdminAccount() {
  try {
    console.log('Creating admin account...');
    
    const adminData = {
      email: 'bryce@mschool.com.tw',
      password: 'school-taiwan-english',
      full_name: 'System Administrator',
      role: 'admin',
      username: 'brycev'
    };

    // Check if user already exists
    const existingUser = await DatabaseService.getUserByEmail(adminData.email);
    if (existingUser) {
      console.log('✅ Admin user already exists:', adminData.email);
      return;
    }

    const user = await DatabaseService.createUserWithPassword(adminData);
    
    if (user) {
      console.log('✅ Admin account created successfully!');
      console.log('Email:', adminData.email);
      console.log('Password:', adminData.password);
      console.log('Role:', user.role);
    } else {
      console.error('❌ Failed to create admin account');
    }
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
  }
}

createAdminAccount();
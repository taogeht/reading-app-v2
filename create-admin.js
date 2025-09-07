// Create admin account with secure password input
// Run with: node create-admin.js

import { DatabaseService } from './src/lib/database-service.js';
import { createInterface } from 'readline';

// Function to read password securely (hidden input)
function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Hide input for password
    const stdin = process.stdin;
    stdin.on('keypress', () => {
      // Clear the line to hide typed characters
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(prompt);
    });

    rl.question(prompt, (password) => {
      rl.close();
      resolve(password);
    });

    // Disable echo
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
  });
}

// Function to read normal input
function readInput(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (input) => {
      rl.close();
      resolve(input);
    });
  });
}

// Password validation
function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null; // Valid
}

async function createAdminAccount() {
  try {
    console.log('🔐 Admin Account Setup');
    console.log('===================\n');

    // Get admin details
    const email = await readInput('Admin email (default: bryce@mschool.com.tw): ') 
      || 'bryce@mschool.com.tw';
    
    const fullName = await readInput('Full name (default: System Administrator): ') 
      || 'System Administrator';
    
    const username = await readInput('Username (default: brycev): ') 
      || 'brycev';

    // Check if user already exists
    console.log('\nChecking if admin user already exists...');
    const existingUser = await DatabaseService.getUserByEmail(email);
    if (existingUser) {
      console.log('⚠️  Admin user already exists:', email);
      console.log('Use change-admin-password.js to update the password.');
      return;
    }

    // Get secure password
    let password;
    let validationError;
    do {
      console.log('\nPassword requirements:');
      console.log('- At least 8 characters long');
      console.log('- At least one uppercase letter');
      console.log('- At least one lowercase letter');
      console.log('- At least one number\n');
      
      password = await readPassword('Enter secure password: ');
      console.log(); // New line after hidden input
      
      validationError = validatePassword(password);
      if (validationError) {
        console.log('❌', validationError);
        console.log('Please try again.\n');
      }
    } while (validationError);

    // Confirm password
    const confirmPassword = await readPassword('Confirm password: ');
    console.log(); // New line after hidden input
    
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match. Please run the script again.');
      return;
    }

    // Create admin account
    console.log('\nCreating admin account...');
    const adminData = {
      email,
      password,
      full_name: fullName,
      role: 'admin',
      username
    };

    const user = await DatabaseService.createUserWithPassword(adminData);
    
    if (user) {
      console.log('✅ Admin account created successfully!');
      console.log('📧 Email:', email);
      console.log('👤 Username:', username);
      console.log('👑 Role:', user.role);
      console.log('\n🔒 Password has been securely hashed and stored.');
      console.log('🚀 You can now log in to the application!');
    } else {
      console.error('❌ Failed to create admin account');
    }
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
  }
}

createAdminAccount();
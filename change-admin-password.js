// Change password for existing admin account
// Run with: node change-admin-password.js

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

async function changeAdminPassword() {
  try {
    console.log('🔄 Change Admin Password');
    console.log('=====================\n');

    // Get admin email
    const email = await readInput('Admin email (default: bryce@mschool.com.tw): ') 
      || 'bryce@mschool.com.tw';

    // Verify user exists
    console.log('\nVerifying admin account exists...');
    const existingUser = await DatabaseService.getUserByEmail(email);
    if (!existingUser) {
      console.log('❌ Admin user not found:', email);
      console.log('Use create-admin.js to create a new admin account.');
      return;
    }

    // Verify admin role
    if (existingUser.role !== 'admin') {
      console.log('❌ User is not an admin:', existingUser.role);
      console.log('This script is only for admin accounts.');
      return;
    }

    console.log('✅ Admin account found:', email);
    console.log('👤 Full name:', existingUser.full_name);

    // Current password verification (optional security step)
    console.log('\nFor security, please verify current password:');
    const currentPassword = await readPassword('Current password: ');
    console.log(); // New line after hidden input

    // Verify current password
    const isCurrentValid = await DatabaseService.verifyPassword(currentPassword, existingUser.password_hash);
    if (!isCurrentValid) {
      console.log('❌ Current password is incorrect. Access denied.');
      return;
    }

    console.log('✅ Current password verified.');

    // Get new password
    let newPassword;
    let validationError;
    do {
      console.log('\nNew password requirements:');
      console.log('- At least 8 characters long');
      console.log('- At least one uppercase letter');
      console.log('- At least one lowercase letter');
      console.log('- At least one number\n');
      
      newPassword = await readPassword('Enter new password: ');
      console.log(); // New line after hidden input
      
      validationError = validatePassword(newPassword);
      if (validationError) {
        console.log('❌', validationError);
        console.log('Please try again.\n');
      }
    } while (validationError);

    // Confirm new password
    const confirmPassword = await readPassword('Confirm new password: ');
    console.log(); // New line after hidden input
    
    if (newPassword !== confirmPassword) {
      console.error('❌ Passwords do not match. Please run the script again.');
      return;
    }

    // Check if new password is same as current
    const isSamePassword = await DatabaseService.verifyPassword(newPassword, existingUser.password_hash);
    if (isSamePassword) {
      console.log('❌ New password cannot be the same as current password.');
      return;
    }

    // Update password
    console.log('\nUpdating admin password...');
    const success = await DatabaseService.updateUserPassword(email, newPassword);
    
    if (success) {
      console.log('✅ Admin password updated successfully!');
      console.log('🔒 Password has been securely hashed and stored.');
      console.log('🚀 You can now log in with your new password!');
    } else {
      console.error('❌ Failed to update admin password');
    }
  } catch (error) {
    console.error('❌ Error changing admin password:', error);
  }
}

changeAdminPassword();
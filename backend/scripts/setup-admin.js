// Admin Setup Script
// Run this script to create your first admin user securely

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/auth';
const SETUP_KEY = '7GkP9$mN2@vX8&wQ4*zR6!tY3'; // Same as in .env

// Admin credentials (CHANGE THESE FOR PRODUCTION)
const adminCredentials = {
  email: 'admin@bukSU.edu.ph',
  name: 'System Administrator',
  password: 'SecureAdminPass2024!', // Minimum 8 characters
  setupKey: SETUP_KEY
};

async function setupAdmin() {
  try {
    console.log('🚀 Starting secure admin setup...\n');
    
    // Validate credentials locally first
    if (adminCredentials.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!adminCredentials.email.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    console.log('✅ Local validation passed');
    console.log('📧 Email:', adminCredentials.email);
    console.log('👤 Name:', adminCredentials.name);
    console.log('🔑 Setup Key: ***PROTECTED***\n');
    
    // Make API request
    const response = await axios.post(`${API_BASE_URL}/setup-admin`, adminCredentials);
    
    if (response.data.success) {
      console.log('🎉 SUCCESS! Admin user created successfully!');
      console.log('📋 Admin Details:');
      console.log('   ID:', response.data.user.id);
      console.log('   Email:', response.data.user.email);
      console.log('   Name:', response.data.user.name);
      console.log('   Role:', response.data.user.role);
      console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
      console.log('   • Store these credentials securely');
      console.log('   • Change the ADMIN_SETUP_KEY in .env file');
      console.log('   • This setup endpoint should be disabled in production');
      console.log('   • Consider implementing bcrypt for password hashing');
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data.message);
      console.error('📊 Status:', error.response.status);
    } else {
      console.error('❌ Network Error:', error.message);
    }
  }
}

// Run the setup
setupAdmin();
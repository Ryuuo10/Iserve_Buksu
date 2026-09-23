const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

async function resetAdminPassword() {
  try {
    const email = 'admin@bukSU.edu.ph';
    const password = 'SecureAdminPass2024!';
    
    console.log('Resetting admin password...');
    console.log('Email:', email);
    
    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully');
    
    // Find and update the admin user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      user.password = hashedPassword;
      user.isVerified = true;
      user.status = 'active';
      
      await user.save();
      console.log('✅ Admin password reset successfully');
      
      console.log('\n📋 Updated Account Details:');
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Name:', user.name);
      console.log('Is Verified:', user.isVerified);
      console.log('Status:', user.status);
      
      // Test password verification
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('Password Verification Test:', isPasswordValid ? '✅ PASSED' : '❌ FAILED');
      
      console.log('\n🔐 Login Credentials:');
      console.log('   Email:', email);
      console.log('   Password:', password);
      console.log('   Role:', user.role);
      console.log('   Login URL: http://localhost:5173/auth?role=admin');
      
    } else {
      console.log('❌ Admin user not found');
    }
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the reset function
resetAdminPassword();

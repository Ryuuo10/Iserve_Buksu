const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { DEFAULT_ADMIN_PERMISSIONS, normalizeAdminPermissions } = require('./utils/adminPermissions');
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

async function createAdmin() {
  try {
    const email = 'admin@bukSU.edu.ph';
    const password = 'SecureAdminPass2024!';
    
    console.log('Creating admin account...');
    console.log('Email:', email);
    
    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully');
    
    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      console.log('Admin user already exists, updating password...');
      user.password = hashedPassword;
      user.isVerified = true;
      user.status = 'active';
      if (user.role === 'admin' && !normalizeAdminPermissions(user.permissions).includes('grievances.edit')) {
        user.permissions = DEFAULT_ADMIN_PERMISSIONS;
      }
      await user.save();
      console.log('✅ Admin password updated successfully');
    } else {
      console.log('Creating new admin user...');
      user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'admin',
        permissions: DEFAULT_ADMIN_PERMISSIONS,
        name: 'System Administrator',
        isVerified: true,
        status: 'active',
        profilePicture: null,
        office: null,
        googleId: `admin_${Date.now()}`, // Unique googleId to avoid index conflict
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await user.save();
      console.log('✅ New admin account created successfully');
    }
    
    console.log('\n📋 Account Details:');
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
    
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the create function
createAdmin();

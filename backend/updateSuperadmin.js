const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

async function updateSuperAdmin() {
  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'iservebuksu@gmail.com').toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD;
    const role = 'superadmin';
    const legacyEmails = ['superadmin@buksu.edu.ph', 'superadmin@buksu.edu.ph'.toLowerCase()];

    if (!password) {
      throw new Error('SUPERADMIN_PASSWORD is required');
    }
    
    console.log('Updating superadmin account...');
    console.log('Email:', email);
    console.log('Role:', role);
    
    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully');
    
    const emailOwner = await User.findOne({ email });
    if (emailOwner && emailOwner.role !== 'superadmin') {
      throw new Error(`Target email ${email} is already used by a non-superadmin account`);
    }

    let user = emailOwner;
    if (!user) {
      user = await User.findOne({
        $or: [
          { email: { $in: legacyEmails } },
          { role: 'superadmin' },
        ],
      }).sort({ updatedAt: -1, createdAt: -1 });
    }

    if (user) {
      console.log('User exists, migrating/updating superadmin account...');
      
      // Update existing user
      user.email = email;
      user.role = role;
      user.password = hashedPassword;
      user.isVerified = true; // Ensure the account is verified
      user.verifiedEmail = true;
      user.status = 'active'; // Ensure the account is active
      
      await user.save();
      console.log('✅ Existing user updated successfully');
    } else {
      console.log('User does not exist, creating new superadmin account...');
      
      // Create new user
      user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: role,
        name: 'Super Administrator',
        isVerified: true,
        verifiedEmail: true,
        status: 'active',
        profilePicture: null,
        office: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await user.save();
      console.log('✅ New superadmin account created successfully');
    }
    
    // Verify the user was created/updated correctly
    const verifyUser = await User.findOne({ email });
    console.log('\n📋 Account Verification:');
    console.log('Email:', verifyUser.email);
    console.log('Role:', verifyUser.role);
    console.log('Name:', verifyUser.name);
    console.log('Is Verified:', verifyUser.isVerified);
    console.log('Status:', verifyUser.status);
    console.log('Has Password:', !!verifyUser.password);
    console.log('Password Hash Length:', verifyUser.password ? verifyUser.password.length : 0);
    
    // Test password verification
    const isPasswordValid = await bcrypt.compare(password, verifyUser.password);
    console.log('Password Verification Test:', isPasswordValid ? '✅ PASSED' : '❌ FAILED');
    
    console.log('\n🎉 Superadmin account setup complete!');
    console.log('🔐 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Role:', role);
    console.log('   Login URL: http://localhost:5173/auth?role=admin');
    
  } catch (error) {
    console.error('❌ Error updating superadmin account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the update function
updateSuperAdmin();

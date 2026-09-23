const express = require('express');
const router = express.Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const { verifyGoogleToken } = require('../middleware/googleAuth');
const { authenticateToken } = require('../middleware/auth');
const { DEFAULT_ADMIN_PERMISSIONS, getEffectiveAdminPermissions } = require('../utils/adminPermissions');
const { generateToken } = require('../utils/tokenUtils');
const { getSystemSettingsSnapshot } = require('../utils/systemSettings');
const { emitNotificationsCreated } = require('../utils/notificationRealtime');

// Middleware to verify reCAPTCHA token
const verifyRecaptcha = async (req, res, next) => {
  try {
    const { recaptchaToken } = req.body;

    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token is required',
      });
    }

    // Verify reCAPTCHA token with Google
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
      }
    );

    if (!response.data.success) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed',
      });
    }

    // reCAPTCHA verification passed
    next();
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying reCAPTCHA',
    });
  }
};

// Decide whether to enforce reCAPTCHA. In development we skip verification
const verifyRecaptchaEnabled = (process.env.NODE_ENV === 'production') && (process.env.DISABLE_RECAPTCHA !== 'true');
if (!verifyRecaptchaEnabled) {
  console.log('reCAPTCHA verification is disabled for signup (development or DISABLE_RECAPTCHA=true)');
} else {
  console.log('reCAPTCHA verification is ENABLED for signup');
}

const applyGoogleProfileToUser = (user, googleProfile) => {
  const {
    googleId,
    picture,
    givenName,
    familyName,
    locale,
    verifiedEmail,
    hd,
  } = googleProfile;

  if (!user.googleId) {
    user.googleId = googleId;
  }
  if (picture) {
    user.profilePicture = picture;
  }
  if (givenName) {
    user.givenName = givenName;
  }
  if (familyName) {
    user.familyName = familyName;
  }
  if (locale) {
    user.locale = locale;
  }
  if (verifiedEmail !== undefined) {
    user.verifiedEmail = verifiedEmail;
  }
  if (hd) {
    user.hd = hd;
  }
};

const serializeUserForAuthResponse = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  profilePicture: user.profilePicture,
  givenName: user.givenName,
  familyName: user.familyName,
  locale: user.locale,
  verifiedEmail: user.verifiedEmail,
  hd: user.hd,
  office: user.office,
  complainantType: user.complainantType,
  contact: user.contact,
  phone: user.phone,
  isVerified: user.isVerified,
  lastLogin: user.lastLogin,
  status: user.status,
  permissions: user.role === 'admin' ? getEffectiveAdminPermissions(user) : [],
  hasPassword: !!user.password,
});

const notifyAdminsOfOfficeVerificationRequest = async (user) => {
  try {
    const Notification = require('../models/Notification');
    const admins = await User.find({ role: { $in: ['superadmin', 'admin'] } }).select('_id');
    const notifications = admins.map((admin) => ({
      recipient: admin._id,
      type: 'office_verification_request',
      title: 'New Office Handler Request',
      message: `${user.name} (${user.email}) has registered as an office handler and is awaiting verification.`,
      relatedUser: user._id,
    }));

    if (notifications.length) {
      const createdNotifications = await Notification.insertMany(notifications);
      await emitNotificationsCreated(createdNotifications);
    }
  } catch (notifErr) {
    console.error('Failed to create office verification notification:', notifErr);
  }
};

const isPrivilegedRole = (role) => ['admin', 'superadmin'].includes(role);

const maintenanceModeResponse = {
  success: false,
  code: 'MAINTENANCE_MODE',
  message: 'The system is temporarily unavailable for maintenance. Please try again later.',
};

const VALID_COMPLAINANT_TYPES = ['student', 'staff', 'parent'];

// POST: Traditional Signup with Email/Password
router.post('/signup', verifyRecaptchaEnabled ? verifyRecaptcha : (req, res, next) => next(), async (req, res) => {
  try {
    const { fullName, email, password, role, office, complainantType, recaptchaToken } = req.body;
    const settings = await getSystemSettingsSnapshot();

    // Validate required fields
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, password, and role are required',
      });
    }

    // Validate role
    if (!['complainant', 'office_handler'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only complainant and office_handler are allowed',
      });
    }

    if (settings.maintenanceMode) {
      return res.status(503).json(maintenanceModeResponse);
    }

    // Validate office for office handlers
    if (role === 'office_handler' && !office) {
      return res.status(400).json({
        success: false,
        message: 'Office selection is required for office handlers',
      });
    }

    if (role === 'office_handler') {
      const validOfficeCategory = await OfficeCategory.findOne({
        status: 'active',
        $or: [{ slug: office }, { name: office }],
      }).select('_id');

      if (!validOfficeCategory) {
        return res.status(400).json({
          success: false,
          message: 'Invalid office selection',
        });
      }
    }

    if (role === 'complainant' && !VALID_COMPLAINANT_TYPES.includes(complainantType)) {
      return res.status(400).json({
        success: false,
        message: 'Complainant type is required for complainants',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      // Assign a unique local googleId placeholder to avoid duplicate-null index errors in dev
      googleId: `local_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      name: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role,
      office: office || null,
      complainantType: role === 'complainant' ? complainantType : null,
      isVerified: false, // Can be set to true after email verification
      lastLogin: new Date(),
      status: 'active',
      profilePicture: null
    });

    // Save user to database
    await newUser.save();

    // Notify superadmins/admins if an office handler signed up (needs verification)
    if (role === 'office_handler') {
      await notifyAdminsOfOfficeVerificationRequest(newUser);
    }

    // Generate JWT token (now includes role and isVerified)
    const jwtToken = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: serializeUserForAuthResponse(newUser),
      token: jwtToken,
    });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during signup',
      error: error.message,
      stack: error.stack,
    });
  }
});

const isPublicGoogleSignupRole = (role) => ['complainant', 'office_handler'].includes(role);

// POST: Google Sign-In / Sign-Up
router.post('/google-signin', async (req, res) => {
  try {
    const { token, selectedRole } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    // Verify Google token
    const payload = await verifyGoogleToken(token);

    console.log('Google payload received:', payload);
    const { sub: googleId, email, name, picture, given_name, family_name, locale, email_verified, hd } = payload;
    const googleProfile = {
      googleId,
      picture,
      givenName: given_name,
      familyName: family_name,
      locale,
      verifiedEmail: email_verified,
      hd,
    };
    const settings = await getSystemSettingsSnapshot();
    
    console.log('Extracted Google data:', {
      googleId,
      email,
      name,
      picture,
      given_name,
      family_name,
      locale,
      email_verified,
      hd
    });

    // Check if user exists in database (normalize email to lowercase)
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
        return res.status(503).json(maintenanceModeResponse);
      }

      // User exists - check if they're trying to sign in with a different role
      if (selectedRole && user.role !== selectedRole) {
        return res.status(409).json({
          success: false,
          status: 'ROLE_MISMATCH',
          message: `This email is already registered as a ${user.role.replace('_', ' ').toUpperCase()}`,
          existingRole: user.role,
          attemptedRole: selectedRole,
        });
      }

      // Update Google ID if not already set
      applyGoogleProfileToUser(user, googleProfile);

      // Block unverified office handlers from logging in via Google
      if (user.role === 'office_handler' && !user.isVerified) {
        // If account was blocked (deleted by admin), re-activate but keep as pending
        if (user.status === 'blocked') {
          user.status = 'active';
          await user.save();
        }
        return res.status(403).json({
          success: false,
          status: 'NOT_VERIFIED',
          message: 'Your account is pending verification. Please wait for admin approval before logging in.',
        });
      }

      // Block deleted/blocked accounts from logging in via Google
      if (user.status === 'blocked') {
        return res.status(403).json({
          success: false,
          status: 'BLOCKED',
          message: 'Your account has been blocked. Please contact the administrator.',
        });
      }

      if (user.role === 'complainant' && !user.complainantType) {
        await user.save();

        return res.status(200).json({
          success: true,
          status: 'COMPLAINANT_TYPE_REQUIRED',
          message: 'Please select your complainant type to complete sign-in.',
          user: serializeUserForAuthResponse(user),
        });
      }

      // Update last login
      user.lastLogin = new Date();
      
      console.log('User before save:', user.toObject());
      await user.save();
      console.log('User after save:', user.toObject());

      // Complainant login notifications are intentionally not generated.

      // Generate JWT token
      const jwtToken = generateToken(user);

      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        message: 'Login successful',
        user: serializeUserForAuthResponse(user),
        token: jwtToken,
      });
    }

    const normalizedSelectedRole = selectedRole || null;

    if (!normalizedSelectedRole) {
      return res.status(404).json({
        success: false,
        status: 'GOOGLE_ACCOUNT_NOT_REGISTERED',
        message: 'No account exists for this Google email yet. Please sign up first and choose your account type.',
        user: {
          email: email.toLowerCase(),
          name,
          profilePicture: picture,
          givenName: given_name,
          familyName: family_name,
          locale,
          verifiedEmail: email_verified,
          hd,
        },
      });
    }

    if (!isPublicGoogleSignupRole(normalizedSelectedRole)) {
      return res.status(403).json({
        success: false,
        status: 'ROLE_NOT_ALLOWED',
        message: 'Admin accounts cannot be created with public Google signup. Please contact the system administrator.',
      });
    }

    if (settings.maintenanceMode && !isPrivilegedRole(normalizedSelectedRole)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    if (normalizedSelectedRole === 'office_handler') {
      return res.status(200).json({
        success: true,
        status: 'OFFICE_SELECTION_REQUIRED',
        message: 'Please select your office category to complete registration.',
        user: {
          email: email.toLowerCase(),
          name,
          profilePicture: picture,
          givenName: given_name,
          familyName: family_name,
          locale,
          verifiedEmail: email_verified,
          hd,
          role: 'office_handler',
        },
      });
    }

    if (normalizedSelectedRole === 'complainant') {
      return res.status(200).json({
        success: true,
        status: 'COMPLAINANT_TYPE_REQUIRED',
        message: 'Please select your complainant type to complete registration.',
        user: {
          email: email.toLowerCase(),
          name,
          profilePicture: picture,
          givenName: given_name,
          familyName: family_name,
          locale,
          verifiedEmail: email_verified,
          hd,
          role: 'complainant',
          complainantType: null,
        },
      });
    }

    return res.status(400).json({
      success: false,
      status: 'ROLE_NOT_ALLOWED',
      message: 'Invalid Google signup role.',
    });
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      message: error.message || 'Server error during authentication',
    });
  }
});

router.post('/google-complainant-setup', async (req, res) => {
  try {
    const { token, complainantType } = req.body;
    const settings = await getSystemSettingsSnapshot();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    if (!VALID_COMPLAINANT_TYPES.includes(complainantType)) {
      return res.status(400).json({
        success: false,
        message: 'A valid complainant type is required',
      });
    }

    if (settings.maintenanceMode) {
      return res.status(503).json(maintenanceModeResponse);
    }

    const payload = await verifyGoogleToken(token);
    const { sub: googleId, email, name, picture, given_name, family_name, locale, email_verified, hd } = payload;
    const googleProfile = {
      googleId,
      picture,
      givenName: given_name,
      familyName: family_name,
      locale,
      verifiedEmail: email_verified,
      hd,
    };

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user && user.role !== 'complainant') {
      return res.status(409).json({
        success: false,
        status: 'ROLE_MISMATCH',
        message: `This email is already registered as a ${user.role.replace('_', ' ').toUpperCase()}`,
        existingRole: user.role,
        attemptedRole: 'complainant',
      });
    }

    if (user) {
      if (user.status === 'blocked') {
        return res.status(403).json({
          success: false,
          status: 'BLOCKED',
          message: 'Your account has been blocked. Please contact the administrator.',
        });
      }

      applyGoogleProfileToUser(user, googleProfile);

      if (user.complainantType) {
        return res.status(409).json({
          success: false,
          status: 'ALREADY_COMPLETED',
          message: 'Your complainant type is already set. Please sign in again to continue.',
        });
      }

      user.complainantType = complainantType;
      user.lastLogin = new Date();
      await user.save();

      const jwtToken = generateToken(user);

      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        message: 'Complainant account completed successfully',
        user: serializeUserForAuthResponse(user),
        token: jwtToken,
      });
    }

    user = new User({
      googleId,
      email: email.toLowerCase(),
      name,
      profilePicture: picture,
      givenName: given_name,
      familyName: family_name,
      locale,
      verifiedEmail: email_verified,
      hd,
      role: 'complainant',
      complainantType,
      isVerified: true,
      lastLogin: new Date(),
      status: 'active',
    });

    await user.save();

    const jwtToken = generateToken(user);

    return res.status(201).json({
      success: true,
      status: 'SUCCESS_NEW_USER',
      message: 'Complainant account created and signed in successfully',
      user: serializeUserForAuthResponse(user),
      token: jwtToken,
    });
  } catch (error) {
    console.error('Google Complainant Setup Error:', error);
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      message: error.message || 'Server error during complainant account setup',
    });
  }
});

router.post('/google-office-setup', async (req, res) => {
  try {
    const { token, office } = req.body;
    const settings = await getSystemSettingsSnapshot();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    if (!office) {
      return res.status(400).json({
        success: false,
        message: 'Office selection is required',
      });
    }

    if (settings.maintenanceMode) {
      return res.status(503).json(maintenanceModeResponse);
    }

    const validOfficeCategory = await OfficeCategory.findOne({
      status: 'active',
      $or: [{ slug: office }, { name: office }],
    }).select('_id');

    if (!validOfficeCategory) {
      return res.status(400).json({
        success: false,
        message: 'Invalid office selection',
      });
    }

    const payload = await verifyGoogleToken(token);
    const { sub: googleId, email, name, picture, given_name, family_name, locale, email_verified, hd } = payload;
    const googleProfile = {
      googleId,
      picture,
      givenName: given_name,
      familyName: family_name,
      locale,
      verifiedEmail: email_verified,
      hd,
    };

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user && user.role !== 'office_handler') {
      return res.status(409).json({
        success: false,
        status: 'ROLE_MISMATCH',
        message: `This email is already registered as a ${user.role.replace('_', ' ').toUpperCase()}`,
        existingRole: user.role,
        attemptedRole: 'office_handler',
      });
    }

    if (user) {
      applyGoogleProfileToUser(user, googleProfile);

      if (user.status === 'blocked') {
        user.status = 'active';
        user.isVerified = false;
      }

      if (user.isVerified) {
        return res.status(409).json({
          success: false,
          status: 'ALREADY_APPROVED',
          message: 'This office account is already approved. Please sign in again to continue.',
        });
      }

      user.office = office;
      await user.save();

      return res.status(200).json({
        success: true,
        status: 'PENDING_APPROVAL',
        message: 'Your office account is pending verification. Please wait for the approval email before logging in.',
        user: serializeUserForAuthResponse(user),
      });
    }

    user = new User({
      googleId,
      email: email.toLowerCase(),
      name,
      profilePicture: picture,
      givenName: given_name,
      familyName: family_name,
      locale,
      verifiedEmail: email_verified,
      hd,
      role: 'office_handler',
      office,
      isVerified: false,
      lastLogin: new Date(),
      status: 'active',
    });

    await user.save();
    await notifyAdminsOfOfficeVerificationRequest(user);

    return res.status(201).json({
      success: true,
      status: 'PENDING_APPROVAL',
      message: 'Your office account request has been submitted. Please wait for the approval email before logging in.',
      user: serializeUserForAuthResponse(user),
    });
  } catch (error) {
    console.error('Google Office Setup Error:', error);
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      message: error.message || 'Server error during office account setup',
    });
  }
});

// POST: Secure Admin Setup (ONE-TIME USE WITH SECURITY CHECKS)
// This endpoint includes multiple security layers for initial admin creation
router.post('/setup-admin', async (req, res) => {
  try {
    const { email, name, password, setupKey } = req.body;
    
    // Security Layer 1: Environment-based setup key verification
    const requiredSetupKey = process.env.ADMIN_SETUP_KEY || 'default-setup-key-change-in-production';
    if (setupKey !== requiredSetupKey) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid setup key'
      });
    }
    
    // Security Layer 2: Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, and password are required'
      });
    }
    
    // Security Layer 3: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Security Layer 4: Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Security Layer 5: Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      // Log security attempt
      console.warn(`Security Alert: Attempted admin setup when admin already exists from IP: ${req.ip}`);
      return res.status(409).json({
        success: false,
        message: 'Admin user already exists. Contact system administrator.'
      });
    }
    
    // Security Layer 6: Domain restriction (optional - uncomment if needed)
    // const allowedDomains = ['bukSU.edu.ph', 'admin.bukSU.edu.ph'];
    // const emailDomain = email.split('@')[1];
    // if (!allowedDomains.includes(emailDomain)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Email domain not authorized for admin access'
    //   });
    // }
    
    // Create secure admin user
    const adminUser = new User({
      email: email.toLowerCase(),
      name,
      profilePicture: null,
      password: password, // Will be hashed in production
      role: 'admin',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      office: null,
      isVerified: true,
      lastLogin: null,
      status: 'active'
    });
    
    await adminUser.save();
    
    // Log successful admin creation
    console.log(`Security Log: Admin user created successfully - ${email}`);
    
    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully. Please secure your credentials.',
      user: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Admin Setup Error:', error);
    // Don't expose internal errors to client
    return res.status(500).json({
      success: false,
      message: 'Error during admin setup. Please try again.'
    });
  }
});

// POST: Traditional Login with Email/Password
router.post('/login', verifyRecaptchaEnabled ? verifyRecaptcha : (req, res, next) => next(), async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Debug logging
    console.log('🔍 Login Attempt:', {
      email: email?.toLowerCase(),
      role: role,
      passwordLength: password?.length,
      reCAPTCHAEnabled: verifyRecaptchaEnabled
    });

    if (!email || !password) {
      console.log('❌ Missing fields:', { email: !!email, password: !!password, role: !!role });
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    console.log('👤 User found:', {
      found: !!user,
      email: user?.email,
      role: user?.role,
      hasPassword: !!user?.password,
      isVerified: user?.isVerified,
      status: user?.status
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user has password (traditional login)
    if (!user.password) {
      console.log('❌ No password found for user');
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please use Google to sign in.',
      });
    }

    // Check if role matches when a role is explicitly provided (allow 'admin' login for both admin and superadmin)
    console.log('🔐 Role Check:', {
      requestedRole: role || '(auto-detected)',
      userRole: user.role,
      adminLoginAllowed: role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')
    });
    
    if (!role) {
      console.log('✅ Auto-detected login role from user record:', user.role);
    } else if (role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      console.log('✅ Admin login allowed for user role:', user.role);
    } else if (user.role !== role) {
      console.log('❌ Role mismatch');
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role.replace('_', ' ')}. Please select the correct role.`,
      });
    }

    const settings = await getSystemSettingsSnapshot();
    if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    // Block deleted/blocked office handlers - re-activate as pending verification
    if (user.role === 'office_handler' && user.status === 'blocked') {
      user.status = 'active';
      user.isVerified = false;
      await user.save();
      console.log('🔄 Blocked office handler re-activated as pending verification');
      return res.status(403).json({
        success: false,
        message: 'Your account is pending verification. Please wait for admin approval before logging in.',
      });
    }

    // Block unverified office handlers from logging in
    if (user.role === 'office_handler' && !user.isVerified) {
      console.log('❌ Office handler not verified yet');
      return res.status(403).json({
        success: false,
        message: 'Your account is pending verification. Please wait for admin approval before logging in.',
      });
    }

    // Block other blocked accounts from logging in
    if (user.status === 'blocked') {
      console.log('❌ Account is blocked');
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact the administrator.',
      });
    }

    // Validate password using bcrypt
    console.log('🔑 Checking password...');
    const passwordMatches = await bcrypt.compare(password, user.password);
    console.log('🔑 Password match result:', passwordMatches);
    
    if (!passwordMatches) {
      console.log('❌ Password does not match');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Complainant login notifications are intentionally not generated.

    // Generate JWT token
    const jwtToken = generateToken(user);
    
    console.log('🎉 Login successful for:', user.email);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: serializeUserForAuthResponse(user),
      token: jwtToken,
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// GET: Check if email exists and get role
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      return res.status(200).json({
        success: true,
        exists: true,
        role: user.role,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
    });
  } catch (error) {
    console.error('Check Email Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// ADMIN: Get all offices (dynamic from OfficeCategory collection)
router.get('/offices', async (req, res) => {
  try {
    const OfficeCategory = require('../models/OfficeCategory');
    const categories = await OfficeCategory.find({ status: 'active' }).sort({ name: 1 });

    const offices = categories.map(cat => ({
      id: cat.slug,
      name: cat.name,
      college: cat.college || '',
      department: cat.department || '',
    }));

    return res.status(200).json({
      success: true,
      offices
    });
  } catch (error) {
    console.error('Get Offices Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving offices',
    });
  }
});

// Store reset codes in memory (in production, use database or Redis)
const resetCodes = new Map();

// POST: Request password reset code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        success: true,
        message: 'If this email exists, a code has been sent',
      });
    }

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store code with expiry (10 minutes)
    const expiryTime = Date.now() + 10 * 60 * 1000;
    resetCodes.set(email.toLowerCase(), { code, expiryTime });

    // Try to send email
    const { sendEmailWithCode } = require('../utils/emailUtils');
    const emailResult = await sendEmailWithCode(email, code, user.name);

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Code sent to ${email}`,
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// POST: Verify reset code
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and code are required',
      });
    }

    const emailLower = email.toLowerCase();
    const storedData = resetCodes.get(emailLower);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No reset code found. Please request a new one.',
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiryTime) {
      resetCodes.delete(emailLower);
      return res.status(400).json({
        success: false,
        message: 'Code expired. Please request a new one.',
      });
    }

    // Check if code matches
    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code. Please try again.',
      });
    }

    // Code is valid, send success
    return res.status(200).json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error) {
    console.error('Verify Reset Code Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// POST: Reset password with verified code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const emailLower = email.toLowerCase();
    const storedData = resetCodes.get(emailLower);

    // Verify code again
    if (!storedData || storedData.code !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code',
      });
    }

    if (Date.now() > storedData.expiryTime) {
      resetCodes.delete(emailLower);
      return res.status(400).json({
        success: false,
        message: 'Code expired',
      });
    }

    // Find user and update password
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear the reset code
    resetCodes.delete(emailLower);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// GET: Get complete user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // Verify token and get user ID
    const { verifyToken } = require('../utils/tokenUtils');
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Find user by ID. Keep password in memory only long enough to determine whether
    // the account supports password-based actions, then omit it from the response.
    const user = await User.findById(decoded.userId);
    
    console.log('Profile endpoint - user found:', user ? {
      _id: user._id,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      status: user.status,
    } : null);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const settings = await getSystemSettingsSnapshot();
    if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    const userResponse = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture,
      givenName: user.givenName,
      familyName: user.familyName,
      locale: user.locale,
      verifiedEmail: user.verifiedEmail,
      hd: user.hd,
      office: user.office,
      complainantType: user.complainantType,
      contact: user.contact,
      phone: user.phone,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasPassword: !!user.password,
      permissions: user.role === 'admin' ? getEffectiveAdminPermissions(user) : [],
    };
    
    console.log('Profile endpoint - response data:', userResponse);

    return res.status(200).json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching profile',
    });
  }
});

// PUT: Update user profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const { verifyToken } = require('../utils/tokenUtils');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const settings = await getSystemSettingsSnapshot();
    if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    const { name, profilePicture, contact, phone } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed || trimmed.length > 100) {
        return res.status(400).json({ success: false, message: 'Name must be 1-100 characters' });
      }
      user.name = trimmed;
    }

    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    if (contact !== undefined) {
      const trimmedContact = String(contact || '').trim();
      if (trimmedContact.length > 120) {
        return res.status(400).json({ success: false, message: 'Contact must be 120 characters or fewer' });
      }
      user.contact = trimmedContact || null;
    }

    if (phone !== undefined) {
      const trimmedPhone = String(phone || '').trim();
      if (trimmedPhone.length > 40) {
        return res.status(400).json({ success: false, message: 'Phone number must be 40 characters or fewer' });
      }
      user.phone = trimmedPhone || null;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role,
        office: user.office,
        complainantType: user.complainantType,
        contact: user.contact,
        phone: user.phone,
        isVerified: user.isVerified,
        status: user.status,
        hasPassword: !!user.password,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

// POST: Change password (authenticated)
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const { verifyToken } = require('../utils/tokenUtils');
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ success: false, message: 'Invalid token' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const settings = await getSystemSettingsSnapshot();
    if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: 'This account uses Google Sign-In and has no password to change' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({ success: false, message: 'Server error changing password' });
  }
});

// Delete Account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete your account' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const settings = await getSystemSettingsSnapshot();
    if (settings.maintenanceMode && !isPrivilegedRole(user.role)) {
      return res.status(503).json(maintenanceModeResponse);
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Cannot delete Google-only accounts via password. Please contact support.' });
    }

    if (user.role === 'superadmin') {
      const superadminCount = await User.countDocuments({ role: 'superadmin', status: 'active' });
      if (superadminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last active superadmin account.',
        });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    await User.findByIdAndDelete(req.user._id);

    return res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting account' });
  }
});

// POST: Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`👤 User logout: ${req.user.email} (${userId})`);

    // Could add logout tracking/logging here if needed
    // For now, just confirm logout
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

module.exports = router;

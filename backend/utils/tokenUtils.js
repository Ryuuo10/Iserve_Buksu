const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: Using default JWT secret. Set JWT_SECRET in production.');
  }
  // user can be a user object or {_id, role, isVerified}
  return jwt.sign(
    {
      userId: user._id || user.userId || user.id,
      role: user.role,
      isVerified: user.isVerified
    },
    secret,
    { expiresIn: '24h' }
  );
};

// Generate refresh token (optional)
const generateRefreshToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
  return jwt.sign(
    { userId, type: 'refresh' }, 
    secret, 
    { expiresIn: '7d' } // Refresh token expires in 7 days
  );
};

// Verify JWT token
const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: Using default JWT secret. Set JWT_SECRET in production.');
  }
  
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken
};
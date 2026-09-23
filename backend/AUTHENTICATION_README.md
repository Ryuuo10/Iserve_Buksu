# Role-Based Authentication System

## Overview
This is a complete JWT-based authentication system for a MERN stack application with three user roles:
- **Complainant** - Users who can file grievances
- **Administrator** - Admin users with full system access
- **Office Handler** - Office staff who handle assigned grievances

## Key Features

### 1. Database as Source of Truth
- User roles are fetched directly from the database on every request
- Frontend cannot manipulate or fake user roles
- Real-time role validation ensures security

### 2. JWT Token Authentication
- Secure token-based authentication
- Tokens expire after 24 hours
- Automatic token validation and user lookup

### 3. Role-Based Access Control
- Fine-grained permission system
- Support for single or multiple role requirements
- Clear 403 Forbidden responses for unauthorized access

## Middleware Functions

### `authenticateToken`
Verifies JWT tokens and attaches user object to request:
```javascript
// Usage
app.get('/protected-route', authenticateToken, (req, res) => {
  // req.user contains the authenticated user object
});
```

### `checkRole(...roles)`
Checks if user has one of the specified roles:
```javascript
// Single role
app.get('/admin-only', authenticateToken, checkRole('admin'), handler);

// Multiple roles
app.post('/grievance', authenticateToken, checkRole('complainant', 'admin'), handler);
```

### Pre-built Role Middlewares
```javascript
const { isAdmin, isComplainant, isOfficeHandler, isAdminOrOffice } = require('../middleware/auth');

// Admin only
router.get('/admin-dashboard', authenticateToken, isAdmin, handler);

// Complainant only
router.post('/file-grievance', authenticateToken, isComplainant, handler);

// Office handler only
router.put('/assign-grievance', authenticateToken, isOfficeHandler, handler);

// Admin or Office handler
router.get('/manage-grievances', authenticateToken, isAdminOrOffice, handler);
```

## API Endpoints Examples

### Public Routes
```
GET /api/protected/public
```

### Protected Routes (Authentication Required)
```
GET /api/protected/protected
```

### Role-Specific Routes
```
GET /api/protected/admin-only          # Requires admin role
GET /api/protected/complainant-only    # Requires complainant role
GET /api/protected/office-only         # Requires office_handler role
GET /api/protected/admin-or-office     # Requires admin OR office_handler role
```

### Dynamic Role Checking
```
GET /api/protected/dynamic-role/admin        # Checks for admin role
GET /api/protected/dynamic-role/complainant  # Checks for complainant role
```

### Grievance Management Examples
```
POST /api/protected/grievance/create    # complainant OR admin
PUT /api/protected/grievance/assign     # admin OR office_handler
DELETE /api/protected/grievance/delete  # admin only
```

## Security Features

### 1. Database Validation
```javascript
// Even if frontend sends fake role, database is checked
const user = await User.findById(decoded.userId); // Always fresh from DB
const userRole = req.user.role; // From database, not request
```

### 2. Account Status Checking
```javascript
// Prevents access for inactive/blocked accounts
if (user.status !== 'active') {
  return res.status(401).json({ message: 'Account is inactive or blocked' });
}
```

### 3. Proper Error Responses
```javascript
// 401 Unauthorized - Invalid token or authentication failed
// 403 Forbidden - Valid token but insufficient permissions
// 401 Unauthorized - Account inactive/blocked
```

## Secure Admin Setup

### One-Time Admin Creation

The system includes a secure admin setup endpoint with multiple security layers:

**Endpoint:** `POST /api/auth/setup-admin`

**Security Features:**
- 🔐 Setup key verification (environment variable controlled)
- 📧 Email format validation
- 🔒 Password strength requirements (min 8 characters)
- 🛡️ Duplicate admin prevention
- 📊 Security logging
- ⚠️ Domain restriction capability (optional)

**Request Body:**
```json
{
  "email": "admin@bukSU.edu.ph",
  "name": "System Administrator",
  "password": "SecureAdminPass2024!",
  "setupKey": "secure-admin-setup-key-2024-change-this"
}
```

### Using the Setup Script

Run the included setup script for easy admin creation:

```bash
cd CAPSTONE/backend
node scripts/setup-admin.js
```

### Manual API Call

Using curl:
```bash
curl -X POST http://localhost:5000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bukSU.edu.ph",
    "name": "System Administrator", 
    "password": "SecureAdminPass2024!",
    "setupKey": "secure-admin-setup-key-2024-change-this"
  }'
```

### Post-Setup Security Actions

1. **Change the ADMIN_SETUP_KEY** in your `.env` file
2. **Disable the setup endpoint** in production
3. **Implement bcrypt** for password hashing
4. **Store admin credentials securely**

### Login as Admin

After setup, login using:
```
POST /api/auth/login
{
  "email": "admin@bukSU.edu.ph",
  "password": "SecureAdminPass2024!",
  "role": "admin"
}
```

### Frontend Integration
```javascript
// Login and store token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token } = await loginResponse.json();
localStorage.setItem('token', token);

// Make authenticated requests
const response = await fetch('/api/protected/admin-only', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

### Testing with Postman
1. **Login first** to get JWT token
2. **Add Authorization header**: `Bearer YOUR_JWT_TOKEN`
3. **Try accessing different role-based endpoints**

### Manual Testing Scenarios
```
# Scenario 1: Complainant trying to access admin route
- Login as complainant
- Try GET /api/protected/admin-only
- Expected: 403 Forbidden

# Scenario 2: Valid admin access
- Login as admin
- Try GET /api/protected/admin-only
- Expected: 200 Success

# Scenario 3: Expired token
- Use expired token
- Try any protected route
- Expected: 401 Unauthorized
```

## Environment Variables Required
```
JWT_SECRET=your_jwt_secret_key_here
MONGODB_URI=your_mongodb_connection_string
```

## Error Response Format
```javascript
// 401 Unauthorized
{
  "success": false,
  "message": "Access token required"
}

// 403 Forbidden
{
  "success": false,
  "message": "Access forbidden. Required role(s): admin. Your role: complainant"
}

// 401 Token Expired
{
  "success": false,
  "message": "Token expired"
}
```

This system ensures robust security by making the database the single source of truth for user roles and implementing proper JWT authentication with role-based access control.
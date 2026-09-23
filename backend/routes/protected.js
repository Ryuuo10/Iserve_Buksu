const express = require('express');
const router = express.Router();
const { 
  authenticateToken, 
  checkRole, 
  isAdmin, 
  isComplainant, 
  isOfficeHandler,
  isAdminOrOffice 
} = require('../middleware/auth');

// Public route - no authentication required
router.get('/public', (req, res) => {
  res.json({
    success: true,
    message: 'This is a public route accessible to everyone'
  });
});

// Protected route - authentication required
router.get('/protected', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'This is a protected route',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Admin-only route
router.get('/admin-only', authenticateToken, isAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Admin-only route accessed successfully',
    user: req.user
  });
});

// Complainant-only route
router.get('/complainant-only', authenticateToken, isComplainant, (req, res) => {
  res.json({
    success: true,
    message: 'Complainant-only route accessed successfully',
    user: req.user
  });
});

// Office handler-only route
router.get('/office-only', authenticateToken, isOfficeHandler, (req, res) => {
  res.json({
    success: true,
    message: 'Office handler-only route accessed successfully',
    user: req.user
  });
});

// Admin or Office handler route (multiple roles)
router.get('/admin-or-office', authenticateToken, isAdminOrOffice, (req, res) => {
  res.json({
    success: true,
    message: 'Admin or Office handler route accessed successfully',
    user: req.user
  });
});

// Dynamic role checking (pass array of allowed roles)
router.get('/dynamic-role/:role', authenticateToken, (req, res) => {
  const requiredRole = req.params.role;
  
  // Use checkRole middleware dynamically
  checkRole(requiredRole)(req, res, () => {
    res.json({
      success: true,
      message: `Route accessed with role: ${requiredRole}`,
      user: req.user
    });
  });
});

// Multiple specific roles example
router.post('/grievance/create', authenticateToken, checkRole('complainant', 'admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Grievance created successfully',
    user: req.user
  });
});

router.put('/grievance/assign', authenticateToken, checkRole('admin', 'office_handler'), (req, res) => {
  res.json({
    success: true,
    message: 'Grievance assigned successfully',
    user: req.user
  });
});

router.delete('/grievance/delete', authenticateToken, isAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Grievance deleted successfully',
    user: req.user
  });
});

module.exports = router;
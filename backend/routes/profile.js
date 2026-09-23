const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  getProfileCompletionStatus, 
  completeUserProfile, 
  getAvailableOffices 
} = require('../controllers/profileController');

// All routes require authentication
router.use(authenticateToken);

// GET: Check if user needs to complete profile
router.get('/completion-status', getProfileCompletionStatus);

// POST: Complete user profile
router.post('/complete', completeUserProfile);

// GET: Get available offices for dropdown
router.get('/offices', getAvailableOffices);

module.exports = router;
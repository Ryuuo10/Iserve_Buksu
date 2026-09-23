const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, checkRole } = require('../middleware/auth');
const {
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_ADMIN_PERMISSIONS,
  normalizeAdminPermissions,
} = require('../utils/adminPermissions');
const {
  clearSystemSettingsCache,
  getOrCreateSystemSettings,
} = require('../utils/systemSettings');

const router = express.Router();

// Middleware to ensure superadmin role
const superAdminGuard = [authenticateToken, checkRole('superadmin')];

// Utility function to log audit events
async function logAudit(userId, type, description, status = 'success', details = null, ipAddress = null) {
  try {
    await AuditLog.create({
      user: userId || null,
      type,
      description,
      status,
      details,
      ipAddress
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

function buildAuditLogFilter({ type, startDate, endDate }) {
  const filter = {};

  if (type && type !== 'all') {
    filter.type = type;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
  }

  return filter;
}

// =====================================================
// ADMIN USERS MANAGEMENT
// =====================================================

// GET all admin users
router.get('/users', superAdminGuard, async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ['admin', 'superadmin'] }
    }).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: admins,
      count: admins.length,
      availablePermissions: ADMIN_PERMISSION_GROUPS,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin users' });
  }
});

// CREATE new admin user
router.post('/users', superAdminGuard, async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    console.log('Creating admin user with:', { name, email, userId: req.user._id });

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new admin user with unique googleId placeholder to avoid duplicate key error
    const newAdmin = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      permissions: normalizeAdminPermissions(permissions ?? DEFAULT_ADMIN_PERMISSIONS),
      isVerified: true,
      status: 'active',
      googleId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Unique placeholder for non-OAuth users
    });

    await newAdmin.save();
    const createdAdmin = newAdmin.toObject();
    delete createdAdmin.password;

    console.log('Admin user created successfully:', newAdmin._id);

    // Log audit
    await logAudit(req.user._id, 'create', `Created new admin user: ${email}`, 'success', `Name: ${name}`);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: createdAdmin
    });
  } catch (error) {
    console.error('Error creating admin:', error.message, error.stack);
    await logAudit(req.user._id, 'create', 'Failed to create admin user', 'failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to create admin user' });
  }
});

// UPDATE admin user
router.put('/users/:adminId', superAdminGuard, async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, password, permissions } = req.body;

    // Find admin
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Prevent modifying superadmin by non-creator
    if (admin.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot modify superadmin account' });
    }

    // Update fields
    if (name) admin.name = name;
    if (admin.role === 'admin' && permissions !== undefined) {
      admin.permissions = normalizeAdminPermissions(permissions);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }
      admin.password = await bcrypt.hash(password, 12);
    }

    await admin.save();
    const updatedAdmin = admin.toObject();
    delete updatedAdmin.password;

    // Log audit
    await logAudit(req.user._id, 'update', `Updated admin user: ${admin.email}`, 'success');

    res.json({
      success: true,
      message: 'Admin user updated successfully',
      data: updatedAdmin
    });
  } catch (error) {
    console.error('Error updating admin:', error.message);
    await logAudit(req.user._id, 'update', 'Failed to update admin user', 'failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update admin user' });
  }
});

// DELETE admin user
router.delete('/users/:adminId', superAdminGuard, async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Prevent deletion of superadmin
    if (admin.role === 'superadmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete superadmin account' });
    }

    // Prevent self-deletion
    if (adminId === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(adminId);

    // Log audit
    await logAudit(req.user._id, 'delete', `Deleted admin user: ${admin.email}`, 'success');

    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting admin:', error.message);
    await logAudit(req.user._id, 'delete', 'Failed to delete admin user', 'failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete admin user' });
  }
});

// =====================================================
// SYSTEM SETTINGS
// =====================================================

// GET system settings
router.get('/settings', superAdminGuard, async (req, res) => {
  try {
    const settings = await getOrCreateSystemSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch system settings' });
  }
});

// UPDATE system settings
router.post('/settings', superAdminGuard, async (req, res) => {
  try {
    const {
      systemName,
      maintenanceMode,
      emailNotifications,
      maxGrievancesPerUser,
      grievanceExpiryDays
    } = req.body;

    const settings = await getOrCreateSystemSettings();

    if (maxGrievancesPerUser !== undefined && Number(maxGrievancesPerUser) < 1) {
      return res.status(400).json({ success: false, message: 'Max grievances per user must be at least 1' });
    }

    if (grievanceExpiryDays !== undefined && Number(grievanceExpiryDays) < 1) {
      return res.status(400).json({ success: false, message: 'Grievance expiry days must be at least 1' });
    }

    // Update settings
    if (systemName !== undefined) settings.systemName = String(systemName).trim() || settings.systemName;
    if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (maxGrievancesPerUser !== undefined) settings.maxGrievancesPerUser = Number(maxGrievancesPerUser);
    if (grievanceExpiryDays !== undefined) settings.grievanceExpiryDays = Number(grievanceExpiryDays);
    
    settings.updatedBy = req.user._id;

    await settings.save();
    clearSystemSettingsCache();

    const populatedSettings = await settings.populate('updatedBy', 'name email role');

    // Log audit
    await logAudit(req.user._id, 'update', 'Updated system settings', 'success');

    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: populatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error.message);
    await logAudit(req.user._id, 'update', 'Failed to update system settings', 'failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to update system settings' });
  }
});

// =====================================================
// AUDIT LOGS
// =====================================================

// GET audit logs
router.get('/audit-logs', superAdminGuard, async (req, res) => {
  try {
    const { type, startDate, endDate, limit = 100, skip = 0 } = req.query;
    const parsedLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 100));
    const parsedSkip = Math.max(0, parseInt(skip, 10) || 0);
    const filter = buildAuditLogFilter({ type, startDate, endDate });

    const logs = await AuditLog.find(filter)
      .populate('user', 'email name')
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .skip(parsedSkip);

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
      total,
      limit: parsedLimit,
      skip: parsedSkip
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

// GET audit logs statistics
router.get('/audit-logs/stats', superAdminGuard, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const filter = buildAuditLogFilter({ type, startDate, endDate });
    const stats = await AuditLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const successCount = await AuditLog.countDocuments({ ...filter, status: 'success' });
    const failureCount = await AuditLog.countDocuments({ ...filter, status: 'failed' });

    res.json({
      success: true,
      data: {
        byType: stats,
        successCount,
        failureCount,
        totalCount: successCount + failureCount
      }
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit statistics' });
  }
});

// EXPORT audit logs
router.get('/audit-logs/export', superAdminGuard, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const filter = buildAuditLogFilter({ type, startDate, endDate });
    const logs = await AuditLog.find(filter)
      .populate('user', 'email name')
      .sort({ createdAt: -1 });

    // Log the export action
    await logAudit(req.user._id, 'export', 'Exported audit logs', 'success', `Total records: ${logs.length}`);

    res.json({
      success: true,
      data: logs,
      message: 'Audit logs exported successfully'
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error.message);
    await logAudit(req.user._id, 'export', 'Failed to export audit logs', 'failed', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to export audit logs' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Grievance = require('../models/Grievance');
const { authenticateToken, checkRole, requirePermission } = require('../middleware/auth');
const {
  updateWithLockAndTransaction,
  formatConflictResponse,
} = require('../utils/concurrencyUtils');
const { broadcastSuccessfulUpdate } = require('../utils/socketEvents');

// GET: Fetch all complainants with search and filter
router.get('/complainants', authenticateToken, checkRole('admin', 'superadmin'), requirePermission('users.manage'), async (req, res) => {
  try {
    // Check if user is admin or superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const {
      page = 1,
      limit = 10,
      search = '',
      status = ''
    } = req.query;

    // Build search query
    const query = { role: 'complainant' };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [complainants, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Format response data
    const formattedComplainants = complainants.map(complainant => ({
      id: complainant._id,
      email: complainant.email,
      name: complainant.name,
      role: complainant.role,
      complainantType: complainant.complainantType,
      version: complainant.__v,
      status: complainant.status || 'active',
      isVerified: complainant.isVerified || false,
      profilePicture: complainant.profilePicture
    }));

    return res.status(200).json({
      success: true,
      data: formattedComplainants,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: skip + parseInt(limit) < total,
        hasPreviousPage: parseInt(page) > 1
      },
      filters: {
        search,
        status
      }
    });

  } catch (error) {
    console.error('❌ Fetch complainants error:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error fetching complainants',
      error: error.message
    });
  }
});

// PUT: Update complainant status (active/inactive)
router.put('/complainants/:userId/status', authenticateToken, checkRole('admin', 'superadmin'), requirePermission('users.manage'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, version } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active or inactive'
      });
    }

    // Find complainant
    const complainant = await User.findOne({ _id: userId, role: 'complainant' });
    if (!complainant) {
      return res.status(404).json({
        success: false,
        message: 'Complainant not found'
      });
    }

    // Check version conflict if provided
    if (version !== undefined && complainant.__v !== version) {
      return res.status(409).json(
        formatConflictResponse(complainant, { status })
      );
    }

    // Update with version check
    const updated = await User.findByIdAndUpdate(
      userId,
      { 
        status: status,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Complainant not found'
      });
    }

    // Log the action
    console.log(`Admin ${req.user.email} updated complainant ${updated.email} status to ${status}`);

    return res.status(200).json({
      success: true,
      message: `Complainant status updated to ${status}`,
      data: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        status: updated.status,
        version: updated.__v,
        updatedAt: updated.updatedAt
      }
    });

  } catch (error) {
    console.error('Update complainant status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating complainant status'
    });
  }
});

// DELETE: Delete complainant (with safety checks)
// DELETE: Delete complainant (with version-based optimistic locking and transaction)
router.delete('/complainants/:userId', authenticateToken, checkRole('admin', 'superadmin'), requirePermission('users.manage'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { version } = req.body || {};

    // Find the complainant first
    const complainant = await User.findOne({ _id: userId, role: 'complainant' });
    
    if (!complainant) {
      return res.status(404).json({
        success: false,
        message: 'Complainant not found'
      });
    }

    // Check version conflict if provided
    if (version !== undefined && complainant.__v !== version) {
      return res.status(409).json(
        formatConflictResponse(complainant, { action: 'delete' })
      );
    }

    if (complainant.status !== 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'Deactivate this complainant before deleting the account'
      });
    }

    const activeGrievanceStatuses = ['pending', 'under_review', 'in_progress', 'escalated'];

    const activeGrievances = await Grievance.countDocuments({
      complainantId: complainant._id,
      archived: { $ne: true },
      status: { $in: activeGrievanceStatuses }
    });

    if (activeGrievances > 0) {
      return res.status(400).json({
        success: false,
        message: `This complainant still has ${activeGrievances} active grievance${activeGrievances === 1 ? '' : 's'}. Deletion is blocked to preserve case handling.`
      });
    }

    // Use transaction for atomic delete operation
    const result = await updateWithLockAndTransaction(
      User,
      userId,
      async (doc, session) => {
        const grievanceHistory = await Grievance.countDocuments({
          complainantId: complainant._id
        });

        // Anonymize grievance history within transaction
        if (grievanceHistory > 0) {
          await Grievance.updateMany(
            { complainantId: complainant._id },
            {
              $set: {
                complainantId: null,
                complainantName: null,
                complainantEmail: null,
                isAnonymous: true,
                lastUpdatedBy: req.user._id
              }
            },
            { session }
          );
        }

        // Delete the complainant within transaction
        await User.findByIdAndDelete(userId, { session });

        return { grievanceHistory, deletedUser: doc.toObject() };
      },
      version
    );

    if (!result.success) {
      if (result.conflict) {
        return res.status(result.statusCode).json(
          formatConflictResponse(complainant, { action: 'delete' })
        );
      }
      return res.status(result.statusCode).json({ success: false, message: result.error });
    }

    const { grievanceHistory, deletedUser } = result.data;

    // Log the action
    console.log(`Admin ${req.user.email} deleted complainant ${complainant.email}`);

    // Broadcast deletion via Socket.io
    const io = req.app?.io;
    if (io) {
      io.emit('complainant_deleted', {
        userId: complainant._id,
        email: complainant.email,
        anonymizedGrievances: grievanceHistory
      });
    }

    return res.status(200).json({
      success: true,
      message: grievanceHistory > 0
        ? 'Complainant deleted and grievance history anonymized successfully'
        : 'Complainant deleted successfully',
      data: {
        id: deletedUser._id,
        name: deletedUser.name,
        email: deletedUser.email,
        anonymizedGrievances: grievanceHistory
      }
    });

  } catch (error) {
    console.error('Delete complainant error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting complainant'
    });
  }
});

// GET: Get complainant statistics
router.get('/complainants/stats', authenticateToken, checkRole('admin', 'superadmin'), requirePermission('users.manage'), async (req, res) => {
  try {
    console.log('🔍 Fetching stats - User:', req.user?.email, 'Role:', req.user?.role);
    
    // Check if user is admin or superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      console.log('❌ Access denied for role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await User.aggregate([
      { $match: { role: 'complainant' } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          recentLogins: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$lastLogin',
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      active: 0,
      inactive: 0,
      verified: 0,
      unverified: 0,
      recentLogins: 0
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get complainant stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching complainant statistics'
    });
  }
});

// GET: Export complainants data
router.get('/complainants/export', authenticateToken, checkRole('admin', 'superadmin'), requirePermission('users.manage'), async (req, res) => {
  try {
    const { format = 'json', status = '', search = '' } = req.query;

    // Build query
    const query = { role: 'complainant' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const complainants = await User.find(query)
      .select('-password')
      .sort({ name: 1 });

    if (format === 'csv') {
      // Convert to CSV format with proper escaping
      const escCSV = (val) => `"${String(val != null ? val : '').replace(/"/g, '""')}"`;
      const csvHeader = 'Name,Email,Type,Status,Verified\n';
      const csvData = complainants.map(user => 
        [
          escCSV(user.name),
          escCSV(user.email),
          escCSV(user.complainantType || ''),
          escCSV(user.status),
          escCSV(user.isVerified ? 'Yes' : 'No')
        ].join(',')
      ).join('\n');
      
      const csv = csvHeader + csvData;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=complainants.csv');
      return res.send(csv);
    }

    // Default JSON format
    const jsonData = complainants.map(user => ({
      name: user.name,
      email: user.email,
      complainantType: user.complainantType,
      status: user.status,
      verified: user.isVerified
    }));

    return res.status(200).json({
      success: true,
      data: jsonData
    });

  } catch (error) {
    console.error('Export complainants error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error exporting complainants'
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { hasAdminPermission } = require('../utils/adminPermissions');
const { updateLiveCounts } = require('../utils/socketEvents');

const ensureAdminNotificationAccess = (req, res, next) => {
  if (req.user?.role === 'admin' && !hasAdminPermission(req.user, 'notifications.view')) {
    return res.status(403).json({
      success: false,
      message: 'Missing required permission: notifications.view',
    });
  }

  return next();
};

// GET: Fetch notifications for the authenticated user
router.get('/', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('relatedUser', 'name email role profilePicture')
      .populate('relatedGrievance', 'referenceNumber subject category priority office department status isAnonymous')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    return res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

const getStaffGrievanceNotificationFilter = (user) => {
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    return {
      type: 'grievance_submitted',
      title: { $in: ['New Grievance Received', 'Critical Grievance Alert'] },
    };
  }

  if (user?.role === 'office_handler') {
    return {
      type: 'office_handler_assignment',
      title: 'New Grievance Assigned',
    };
  }

  return null;
};

// GET: Unseen staff grievance notifications for startup toast summaries
router.get('/staff-grievance-unseen', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    const staffFilter = getStaffGrievanceNotificationFilter(req.user);

    if (!staffFilter) {
      return res.json({ success: true, notifications: [], count: 0 });
    }

    const notifications = await Notification.find({
      recipient: req.user._id,
      read: false,
      seen: { $ne: true },
      relatedGrievance: { $ne: null },
      ...staffFilter,
    })
      .populate('relatedGrievance', 'referenceNumber subject category priority office department status isAnonymous')
      .sort({ createdAt: -1 })
      .limit(25);

    return res.json({ success: true, notifications, count: notifications.length });
  } catch (error) {
    console.error('Get unseen staff grievance notifications error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT: Mark staff grievance notifications as seen by the toast surface only
router.put('/staff-grievance-seen', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    const notificationIds = Array.isArray(req.body?.notificationIds)
      ? req.body.notificationIds.filter(Boolean)
      : [];

    if (!notificationIds.length) {
      return res.json({ success: true, modifiedCount: 0 });
    }

    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient: req.user._id,
        relatedGrievance: { $ne: null },
        read: false,
        seen: { $ne: true },
      },
      {
        $set: {
          seen: true,
          seenAt: new Date(),
        },
      }
    );

    return res.json({ success: true, modifiedCount: result.modifiedCount || 0 });
  } catch (error) {
    console.error('Mark staff grievance notifications seen error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT: Mark a single notification as read
router.put('/:id/read', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true, seen: true, seenAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Emit real-time update
    const io = req.app.locals.io;
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    updateLiveCounts(io, req.user._id.toString(), { unreadNotifications: unreadCount });

    return res.json({ success: true, notification });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT: Mark all notifications as read
router.put('/read-all', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true, seen: true, seenAt: new Date() }
    );

    // Emit real-time update
    const io = req.app.locals.io;
    updateLiveCounts(io, req.user._id.toString(), { unreadNotifications: 0 });

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

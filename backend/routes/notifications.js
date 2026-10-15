const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { canReceiveCriticalAlerts, isActiveCriticalGrievance } = require('../utils/criticalAlerts');
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

const ensureCriticalAlertAccess = (req, res, next) => {
  if (!canReceiveCriticalAlerts(req.user)) {
    return res.status(403).json({ success: false, message: 'Critical alerts require grievance and notification access' });
  }
  return next();
};

// Acknowledgment is independent of notification read/seen state.
router.get('/critical-alerts', authenticateToken, ensureCriticalAlertAccess, async (req, res) => {
  try {
    const alerts = await Notification.find({
      recipient: req.user._id,
      type: 'grievance_submitted',
      title: 'Critical Grievance Alert',
    }).select('_id relatedGrievance createdAt acknowledgedAt')
      .populate('relatedGrievance', 'referenceNumber priority status archived aiAnalysisOverride.urgency.label')
      .sort({ createdAt: -1 }).lean();
    const active = alerts.filter((alert) => isActiveCriticalGrievance(alert.relatedGrievance));
    return res.json({
      success: true,
      criticalCount: new Set(active.map((alert) => String(alert.relatedGrievance._id))).size,
      notifications: active.filter((alert) => !alert.acknowledgedAt).map((alert) => ({
        _id: alert._id,
        createdAt: alert.createdAt,
        relatedGrievance: {
          _id: alert.relatedGrievance._id,
          referenceNumber: alert.relatedGrievance.referenceNumber,
        },
        reason: 'Critical urgency classification. Immediate review required.',
      })),
    });
  } catch (error) {
    console.error('Get critical alerts error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load critical alerts' });
  }
});

router.put('/critical-alerts/acknowledge', authenticateToken, ensureCriticalAlertAccess, async (req, res) => {
  const ids = req.body?.notificationIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 ||
      !ids.every((id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))) {
    return res.status(400).json({ success: false, message: 'Provide up to 100 valid notification IDs' });
  }
  try {
    await Notification.updateMany({
      _id: { $in: ids }, recipient: req.user._id,
      type: 'grievance_submitted', title: 'Critical Grievance Alert',
      acknowledgedAt: null,
    }, { $set: { acknowledgedAt: new Date() } });
    req.app.locals.io?.to(`user_${req.user._id}`).emit('critical_alert_acknowledged');
    return res.json({ success: true });
  } catch (error) {
    console.error('Acknowledge critical alerts error:', error);
    return res.status(500).json({ success: false, message: 'Unable to acknowledge critical alerts' });
  }
});

// GET: Fetch notifications for the authenticated user
router.get('/', authenticateToken, ensureAdminNotificationAccess, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('relatedUser', 'name email role profilePicture')
      .populate('relatedGrievance', 'referenceNumber subject category priority office department status archived aiAnalysisOverride.urgency.label isAnonymous')
      .sort({ createdAt: -1 })
      .limit(50);

    // Keep active critical alerts accessible even outside the recent-history window.
    if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
      const criticalAlerts = await Notification.find({
        recipient: req.user._id,
        type: 'grievance_submitted',
        title: 'Critical Grievance Alert',
      })
        .populate('relatedUser', 'name email role profilePicture')
        .populate('relatedGrievance', 'referenceNumber subject category priority office department status archived aiAnalysisOverride.urgency.label isAnonymous');
      const ids = new Set(notifications.map((notification) => String(notification._id)));
      for (const alert of criticalAlerts) {
        if (isActiveCriticalGrievance(alert.relatedGrievance) && !ids.has(String(alert._id))) {
          notifications.push(alert);
          ids.add(String(alert._id));
        }
      }
    }

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
      title: 'New Grievance Received',
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

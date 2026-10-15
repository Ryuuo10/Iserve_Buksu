const Notification = require('../models/Notification');
const { notifyUser, updateLiveCounts } = require('./socketEvents');
const { getIO } = require('./socketServer');

const NOTIFICATION_POPULATION = [
  { path: 'relatedUser', select: 'name email role profilePicture' },
  { path: 'relatedGrievance', select: 'referenceNumber subject category priority office department status archived aiAnalysisOverride.urgency.label isAnonymous' },
];

const getRecipientId = (notification) => {
  if (!notification?.recipient) {
    return null;
  }

  if (typeof notification.recipient === 'object' && notification.recipient._id) {
    return String(notification.recipient._id);
  }

  return String(notification.recipient);
};

const populateNotification = async (notification) => {
  if (!notification?._id) {
    return notification;
  }

  if (typeof notification.populate === 'function') {
    await notification.populate(NOTIFICATION_POPULATION);
    return notification;
  }

  return Notification.findById(notification._id).populate(NOTIFICATION_POPULATION).lean();
};

const emitUnreadCount = async (io, recipientId) => {
  const unreadCount = await Notification.countDocuments({
    recipient: recipientId,
    read: false,
  });

  updateLiveCounts(io, recipientId, { unreadNotifications: unreadCount });
};

const emitNotificationCreated = async (notification) => {
  const io = getIO();
  const recipientId = getRecipientId(notification);

  if (!io || !recipientId || !notification?._id) {
    return notification;
  }

  const populatedNotification = await populateNotification(notification);
  notifyUser(io, recipientId, populatedNotification);
  await emitUnreadCount(io, recipientId);

  return populatedNotification;
};

const emitNotificationsCreated = async (notifications = []) => {
  const io = getIO();
  if (!io || !notifications.length) {
    return notifications;
  }

  const recipientIds = new Set();

  await Promise.all(
    notifications.map(async (notification) => {
      const recipientId = getRecipientId(notification);
      if (!recipientId || !notification?._id) {
        return;
      }

      recipientIds.add(recipientId);
      const populatedNotification = await populateNotification(notification);
      notifyUser(io, recipientId, populatedNotification);
    })
  );

  await Promise.all(Array.from(recipientIds).map((recipientId) => emitUnreadCount(io, recipientId)));

  return notifications;
};

module.exports = {
  emitNotificationCreated,
  emitNotificationsCreated,
};

// Helper functions to emit real-time events through Socket.IO

/**
 * Notify a specific user about a new notification
 * @param {object} io - Socket.IO instance
 * @param {string} userId - User ID to notify
 * @param {object} notification - Notification object
 */
function notifyUser(io, userId, notification) {
  io.to(`user_${userId}`).emit('new_notification', notification);
}

/**
 * Broadcast a grievance status update to all connected users
 * @param {object} io - Socket.IO instance
 * @param {string} grievanceId - Grievance ID
 * @param {object} grievanceData - Updated grievance data
 */
function broadcastGrievanceUpdate(io, grievanceId, grievanceData) {
  io.emit('grievance_updated', {
    grievanceId,
    data: grievanceData,
    timestamp: new Date()
  });
}

/**
 * Notify specific user about grievance status change
 * @param {object} io - Socket.IO instance
 * @param {string} userId - User ID to notify
 * @param {string} grievanceId - Grievance ID
 * @param {string} status - New status
 * @param {string} message - Status message
 */
function notifyGrievanceStatusChange(io, userId, grievanceId, status, message) {
  io.to(`user_${userId}`).emit('grievance_status_changed', {
    grievanceId,
    status,
    message,
    timestamp: new Date()
  });
}

/**
 * Broadcast live count updates (grievances, notifications, etc.)
 * @param {object} io - Socket.IO instance
 * @param {string} userId - User ID
 * @param {object} counts - Object with counts (e.g., { grievances: 5, notifications: 3 })
 */
function updateLiveCounts(io, userId, counts) {
  io.to(`user_${userId}`).emit('live_counts_update', {
    ...counts,
    timestamp: new Date()
  });
}

/**
 * Notify user about system message (announcements, maintenance, etc.)
 * @param {object} io - Socket.IO instance
 * @param {string} userId - User ID (or 'all' for broadcast)
 * @param {string} message - Message content
 * @param {string} type - Message type (info, warning, error, success)
 */
function sendSystemMessage(io, userId, message, type = 'info') {
  const eventData = {
    message,
    type,
    timestamp: new Date()
  };

  if (userId === 'all') {
    io.emit('system_message', eventData);
  } else {
    io.to(`user_${userId}`).emit('system_message', eventData);
  }
}

/**
 * Notify about office update/announcement
 * @param {object} io - Socket.IO instance
 * @param {string} officeId - Office ID
 * @param {object} announcement - Announcement object
 */
function broadcastOfficeAnnouncement(io, officeId, announcement) {
  io.emit('office_announcement', {
    officeId,
    announcement,
    timestamp: new Date()
  });
}

/**
 * Notify user of concurrency conflict - document was updated by another user
 * @param {object} io - Socket.IO instance
 * @param {string} userId - User ID to notify
 * @param {string} grievanceId - Grievance ID
 * @param {object} conflictData - Conflict details
 */
function notifyConflict(io, userId, grievanceId, conflictData) {
  io.to(`user_${userId}`).emit('grievance_conflict_detected', {
    grievanceId,
    conflict: {
      message: 'This document was just updated by another user',
      timestamp: new Date(),
      currentVersion: conflictData.currentVersion,
      currentState: conflictData.currentState,
      updatedBy: conflictData.updatedBy,
      updatedByName: conflictData.updatedByName,
      suggestion: 'Refresh to see the latest changes, then try again',
      retryable: true
    }
  });
}

/**
 * Broadcast update warning to users viewing the document
 * @param {object} io - Socket.IO instance
 * @param {string} grievanceId - Grievance ID
 * @param {object} updateDetails - Details about the update
 */
function broadcastUpdateWarning(io, grievanceId, updateDetails) {
  io.emit('grievance_update_warning', {
    grievanceId,
    warning: {
      message: `This grievance is being updated by ${updateDetails.updatedByName}`,
      timestamp: new Date(),
      version: updateDetails.version,
      changes: updateDetails.changes,
      action: 'refresh' // Action for UI: refresh, notify, merge
    }
  });
}

/**
 * Notify colleagues about successful update (to prevent duplicate work)
 * @param {object} io - Socket.IO instance
 * @param {string} grievanceId - Grievance ID
 * @param {object} updateData - Update information
 */
function broadcastSuccessfulUpdate(io, grievanceId, updateData) {
  io.emit('grievance_successfully_updated', {
    grievanceId,
    update: {
      timestamp: new Date(),
      version: updateData.version,
      updatedBy: updateData.updatedByName,
      changes: updateData.changes,
      newStatus: updateData.newStatus
    }
  });
}

module.exports = {
  notifyUser,
  broadcastGrievanceUpdate,
  notifyGrievanceStatusChange,
  updateLiveCounts,
  sendSystemMessage,
  broadcastOfficeAnnouncement,
  notifyConflict,
  broadcastUpdateWarning,
  broadcastSuccessfulUpdate
};

/**
 * Concurrency Control Utilities
 * Implements optimistic locking, transactions, and conflict detection
 */

const mongoose = require('mongoose');

/**
 * Attempt update with optimistic locking
 * Returns { success, data, conflict, error }
 * @param {Model} model - Mongoose model
 * @param {string} id - Document ID
 * @param {object} updateData - Data to update
 * @param {number} version - Current version from client
 * @param {object} options - Additional options
 */
async function updateWithOptimisticLock(model, id, updateData, version, options = {}) {
  try {
    // Find current document
    const current = await model.findById(id).select('__v');
    if (!current) {
      return { success: false, error: 'Document not found', statusCode: 404 };
    }

    // Check for version conflict
    if (current.__v !== version) {
      return {
        success: false,
        conflict: true,
        error: 'Document was modified by another user',
        statusCode: 409,
        currentVersion: current.__v,
      };
    }

    // Perform update with version check
    // MongoDB will increment __v automatically
    const updated = await model.findByIdAndUpdate(
      id,
      { ...updateData, ...options.additionalFields },
      {
        new: true,
        runValidators: options.runValidators !== false,
      }
    );

    if (!updated) {
      return { success: false, error: 'Update failed', statusCode: 500 };
    }

    return { success: true, data: updated, statusCode: 200 };
  } catch (error) {
    // Handle version conflict error from Mongoose
    if (error.name === 'VersionError') {
      return {
        success: false,
        conflict: true,
        error: 'Document was modified by another user (version conflict)',
        statusCode: 409,
      };
    }
    return { success: false, error: error.message, statusCode: 500 };
  }
}

/**
 * Execute operation within a transaction
 * @param {function} callback - Async function to execute within transaction
 * @param {object} options - Transaction options
 */
async function executeTransaction(callback, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return { success: true, data: result };
  } catch (error) {
    await session.abortTransaction();
    return { success: false, error: error.message };
  } finally {
    await session.endSession();
  }
}

/**
 * Combined optimistic locking + transaction update
 * For complex updates that need both atomicity and concurrency control
 * @param {Model} model - Mongoose model  
 * @param {string} id - Document ID
 * @param {function} callback - Async function receiving (doc, session) to perform updates
 * @param {number} version - Current version from client (for optimistic lock)
 */
async function updateWithLockAndTransaction(model, id, callback, version) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch with lock
    const current = await model.findById(id).session(session);
    if (!current) {
      await session.abortTransaction();
      return { success: false, error: 'Document not found', statusCode: 404 };
    }

    // Check version
    if (current.__v !== version) {
      await session.abortTransaction();
      return {
        success: false,
        conflict: true,
        error: 'Document was modified by another user',
        statusCode: 409,
        currentVersion: current.__v,
      };
    }

    // Execute callback with session
    const result = await callback(current, session);

    await session.commitTransaction();
    return { success: true, data: result, statusCode: 200 };
  } catch (error) {
    await session.abortTransaction();
    return { success: false, error: error.message, statusCode: 500 };
  } finally {
    await session.endSession();
  }
}

/**
 * Format conflict response for client
 * @param {object} current - Current document state
 * @param {object} incomingData - Data client tried to send
 */
function formatConflictResponse(current, incomingData) {
  return {
    success: false,
    conflict: true,
    message: 'This document was updated by another user',
    currentVersion: current.__v,
    currentState: {
      status: current.status,
      priority: current.priority,
      lastUpdatedBy: current.lastUpdatedBy,
      updatedAt: current.updatedAt,
    },
    incomingChanges: incomingData,
    suggestion: 'Refresh the page to see latest changes, then try again',
  };
}

/**
 * Create conflict notification event for Socket.io
 * @param {object} io - Socket.io instance
 * @param {string} grievanceId - Grievance ID
 * @param {object} conflictData - Conflict details
 */
function emitConflictNotification(io, grievanceId, conflictData) {
  io.emit('grievance_update_conflict', {
    grievanceId,
    conflict: {
      timestamp: new Date(),
      currentVersion: conflictData.currentVersion,
      message: conflictData.message,
      currentState: conflictData.currentState,
      updatedBy: conflictData.updatedBy,
      suggestion: conflictData.suggestion,
    },
  });
}

/**
 * Create version mismatch warning
 * Emitted to users viewing a document that was updated elsewhere
 * @param {object} io - Socket.io instance
 * @param {string} userId - User ID to notify
 * @param {string} grievanceId - Grievance ID
 * @param {object} updateData - What was changed
 */
function emitUpdateWarning(io, userId, grievanceId, updateData) {
  io.to(`user_${userId}`).emit('grievance_updated_by_other', {
    grievanceId,
    warning: {
      message: 'This grievance was just updated by another user',
      timestamp: new Date(),
      changes: updateData,
      action: 'refresh', // Action for client: refresh, notify, merge
    },
  });
}

module.exports = {
  updateWithOptimisticLock,
  executeTransaction,
  updateWithLockAndTransaction,
  formatConflictResponse,
  emitConflictNotification,
  emitUpdateWarning,
};

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'office_verification_request',
        'complainant_login',
        'grievance_submitted',
        'grievance_assigned',
        'grievance_status_updated',
        'grievance_archived',
        'office_handler_verified',
        'office_handler_assignment',
        'office_handler_office_updated',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    relatedGrievance: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', default: null },
    read: { type: Boolean, default: false },
    seen: { type: Boolean, default: false, index: true },
    seenAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, seen: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

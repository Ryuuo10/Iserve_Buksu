const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    systemName: {
      type: String,
      default: 'BukSU Grievance System'
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    maxGrievancesPerUser: {
      type: Number,
      default: 5
    },
    grievanceExpiryDays: {
      type: Number,
      default: 90
    },
    lastMonthlyGrievanceArchiveAt: {
      type: Date,
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSettings', settingsSchema);

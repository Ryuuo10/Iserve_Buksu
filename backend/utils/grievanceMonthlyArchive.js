const Grievance = require('../models/Grievance');
const {
  clearSystemSettingsCache,
  getOrCreateSystemSettings,
} = require('./systemSettings');

let monthlyArchivePromise = null;

const getUtcMonthStart = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
};

const isSameUtcMonth = (left, right) =>
  !!left &&
  !!right &&
  left.getUTCFullYear() === right.getUTCFullYear() &&
  left.getUTCMonth() === right.getUTCMonth();

const runMonthlyGrievanceArchiveIfNeeded = async ({ now = new Date() } = {}) => {
  if (monthlyArchivePromise) {
    return monthlyArchivePromise;
  }

  monthlyArchivePromise = (async () => {
    const normalizedNow = new Date(now);
    const settings = await getOrCreateSystemSettings();
    const lastRun = settings.lastMonthlyGrievanceArchiveAt
      ? new Date(settings.lastMonthlyGrievanceArchiveAt)
      : null;

    if (isSameUtcMonth(lastRun, normalizedNow)) {
      return {
        success: true,
        skipped: true,
        archivedCount: 0,
      };
    }

    const currentMonthStart = getUtcMonthStart(normalizedNow);
    const archiveTimestamp = normalizedNow;
    const monthlyArchiveReason = 'Automatically archived during the monthly grievance reset.';

    const result = await Grievance.updateMany(
      {
        archived: { $ne: true },
        $or: [
          {
            status: 'resolved',
            resolvedAt: { $lt: currentMonthStart, $ne: null },
          },
          {
            status: 'rejected',
            updatedAt: { $lt: currentMonthStart },
          },
        ],
      },
      {
        $set: {
          archived: true,
          archivedAt: archiveTimestamp,
          archiveType: 'monthly_reset',
          archiveReason: monthlyArchiveReason,
        },
      }
    );

    settings.lastMonthlyGrievanceArchiveAt = archiveTimestamp;
    await settings.save();
    clearSystemSettingsCache();

    return {
      success: true,
      skipped: false,
      archivedCount: result.modifiedCount || 0,
    };
  })();

  try {
    return await monthlyArchivePromise;
  } finally {
    monthlyArchivePromise = null;
  }
};

module.exports = {
  runMonthlyGrievanceArchiveIfNeeded,
};

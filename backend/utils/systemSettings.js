const SystemSettings = require('../models/SystemSettings');

const DEFAULT_SETTINGS = Object.freeze({
  systemName: 'BukSU Grievance System',
  maintenanceMode: false,
  emailNotifications: true,
  maxGrievancesPerUser: 5,
  grievanceExpiryDays: 90,
  lastMonthlyGrievanceArchiveAt: null,
  updatedBy: null,
  createdAt: null,
  updatedAt: null,
});

const CACHE_TTL_MS = 30 * 1000;

let cachedSettings = null;
let cacheExpiresAt = 0;

const toPlainSettings = (settingsDoc) => {
  if (!settingsDoc) {
    return { ...DEFAULT_SETTINGS };
  }

  const plain = typeof settingsDoc.toObject === 'function'
    ? settingsDoc.toObject()
    : settingsDoc;

  return {
    ...DEFAULT_SETTINGS,
    ...plain,
  };
};

const getSystemSettingsSnapshot = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now < cacheExpiresAt) {
    return { ...cachedSettings };
  }

  const settings = await SystemSettings.findOne().populate('updatedBy', 'name email role');
  cachedSettings = toPlainSettings(settings);
  cacheExpiresAt = now + CACHE_TTL_MS;

  return { ...cachedSettings };
};

const getOrCreateSystemSettings = async () => {
  let settings = await SystemSettings.findOne().populate('updatedBy', 'name email role');

  if (!settings) {
    settings = await SystemSettings.create({});
    settings = await SystemSettings.findById(settings._id).populate('updatedBy', 'name email role');
  }

  cachedSettings = toPlainSettings(settings);
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return settings;
};

const clearSystemSettingsCache = () => {
  cachedSettings = null;
  cacheExpiresAt = 0;
};

module.exports = {
  DEFAULT_SETTINGS,
  clearSystemSettingsCache,
  getOrCreateSystemSettings,
  getSystemSettingsSnapshot,
};

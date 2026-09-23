const STORAGE_KEY = 'office_system_preferences';

const DEFAULTS = {
  defaultTab: 'dashboard',
  notificationRefreshSeconds: 30,
  dashboardRefreshSeconds: 60,
  queuePageSize: 10,
  soundAlerts: false,
};

const normalizePreferences = (preferences = {}) => {
  const nextPreferences = { ...DEFAULTS, ...preferences };

  if (nextPreferences.defaultTab === 'analytics') {
    nextPreferences.defaultTab = 'resolution-reports';
  }

  return nextPreferences;
};

export const getOfficePreferences = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ...DEFAULTS };
  }

  try {
    return normalizePreferences(JSON.parse(stored));
  } catch (error) {
    console.error('Failed to parse office preferences:', error);
    localStorage.removeItem(STORAGE_KEY);
    return { ...DEFAULTS };
  }
};

export const saveOfficePreferences = (preferences) => {
  const nextPreferences = normalizePreferences(preferences);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
  return nextPreferences;
};

export const OFFICE_PREFERENCE_DEFAULTS = DEFAULTS;

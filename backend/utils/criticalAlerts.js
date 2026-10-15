const { hasAdminPermission } = require('./adminPermissions');

const canReceiveCriticalAlerts = (user) =>
  ['admin', 'superadmin'].includes(user?.role) &&
  hasAdminPermission(user, 'grievances.view') &&
  hasAdminPermission(user, 'notifications.view');

const isCriticalGrievance = (grievance) => {
  const priority = String(
    grievance?.aiAnalysisOverride?.urgency?.label || grievance?.priority ||
    grievance?.aiAnalysis?.urgency?.label || ''
  ).trim().toLowerCase();
  return ['critical', 'urgent'].includes(priority);
};

const isActiveCriticalGrievance = (grievance) =>
  !!grievance && isCriticalGrievance(grievance) && !grievance.archived &&
  !['resolved', 'rejected'].includes(grievance.status);

module.exports = { canReceiveCriticalAlerts, isCriticalGrievance, isActiveCriticalGrievance };

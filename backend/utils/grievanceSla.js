const OPEN_GRIEVANCE_STATUSES = ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'escalated'];
const GRIEVANCE_SLA_HOURS = 72;
const GRIEVANCE_SLA_MS = GRIEVANCE_SLA_HOURS * 60 * 60 * 1000;

const getGrievanceOverdueDeadline = (now = Date.now()) => new Date(now - GRIEVANCE_SLA_MS);

const isOpenGrievanceStatus = (status) => OPEN_GRIEVANCE_STATUSES.includes(status);

const isGrievanceOverdue = (grievance, now = Date.now()) => {
  const createdAt = grievance?.createdAt ? new Date(grievance.createdAt).getTime() : NaN;
  return Number.isFinite(createdAt) && createdAt <= now - GRIEVANCE_SLA_MS;
};

const buildOpenGrievanceQuery = (extra = {}) => ({
  archived: { $ne: true },
  status: { $in: OPEN_GRIEVANCE_STATUSES },
  ...extra,
});

module.exports = {
  OPEN_GRIEVANCE_STATUSES,
  GRIEVANCE_SLA_HOURS,
  GRIEVANCE_SLA_MS,
  getGrievanceOverdueDeadline,
  isOpenGrievanceStatus,
  isGrievanceOverdue,
  buildOpenGrievanceQuery,
};

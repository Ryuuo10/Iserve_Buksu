export const GRIEVANCE_STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  assigned_to_department: 'Assigned to Department',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  escalated: 'Escalated',
};

export const OFFICE_STATUS_LABELS = {
  ...GRIEVANCE_STATUS_LABELS,
  assigned_to_department: 'Received in Pending',
};

export const formatGrievanceStatus = (value, labels = GRIEVANCE_STATUS_LABELS) =>
  labels[value] || String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

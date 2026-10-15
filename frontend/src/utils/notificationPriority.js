export const isActiveCriticalNotification = (notification) => {
  const grievance = notification?.relatedGrievance;
  if (!grievance || grievance.archived || ['resolved', 'rejected'].includes(grievance.status)) return false;
  const urgency = grievance.aiAnalysisOverride?.urgency?.label || grievance.priority;
  return ['critical', 'urgent'].includes(String(urgency || '').trim().toLowerCase());
};

export const compareNotificationPriority = (left, right) =>
  Number(isActiveCriticalNotification(right)) - Number(isActiveCriticalNotification(left)) ||
  new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();

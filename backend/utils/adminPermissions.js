const ADMIN_PERMISSIONS = [
  'dashboard.view',
  'grievances.view',
  'grievances.edit',
  'grievances.delete',
  'grievances.export',
  'notifications.view',
  'users.manage',
  'offices.manage',
  'analytics.view',
];

const ADMIN_PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    permissions: [
      {
        id: 'dashboard.view',
        label: 'View dashboard',
        description: 'Open the admin dashboard overview and summary cards.',
      },
    ],
  },
  {
    id: 'grievances',
    label: 'Grievances',
    permissions: [
      {
        id: 'grievances.view',
        label: 'View grievances',
        description: 'Open grievance lists, details, stats, and queue views.',
      },
      {
        id: 'grievances.edit',
        label: 'Edit grievances',
        description: 'Update grievance status, assignment, and case details.',
      },
      {
        id: 'grievances.delete',
        label: 'Delete grievances',
        description: 'Archive or remove grievance records from admin views.',
      },
      {
        id: 'grievances.export',
        label: 'Export grievances',
        description: 'Download grievance exports and CSV reports.',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    permissions: [
      {
        id: 'notifications.view',
        label: 'View notifications',
        description: 'Access the admin notification bell and notifications module.',
      },
      {
        id: 'users.manage',
        label: 'Manage complainants',
        description: 'View, update, export, and delete complainant accounts.',
      },
      {
        id: 'offices.manage',
        label: 'Manage offices',
        description: 'Approve handlers and maintain office categories.',
      },
      {
        id: 'analytics.view',
        label: 'View analytics',
        description: 'Open analytics dashboards and reporting pages.',
      },
    ],
  },
];

const DEFAULT_ADMIN_PERMISSIONS = [
  'dashboard.view',
  'grievances.view',
  'grievances.edit',
  'notifications.view',
  'analytics.view',
];

const normalizeAdminPermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return [...new Set(
    permissions
      .map((permission) => String(permission || '').trim())
      .filter((permission) => ADMIN_PERMISSIONS.includes(permission))
  )];
};

const getEffectiveAdminPermissions = (user) => {
  if (!user || user.role !== 'admin') {
    return [];
  }

  if (!Array.isArray(user.permissions)) {
    return [...DEFAULT_ADMIN_PERMISSIONS];
  }

  return normalizeAdminPermissions(user.permissions);
};

const hasAdminPermission = (user, permission) => {
  if (!user) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  if (user.role !== 'admin') {
    return false;
  }

  return getEffectiveAdminPermissions(user).includes(permission);
};

module.exports = {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_ADMIN_PERMISSIONS,
  normalizeAdminPermissions,
  getEffectiveAdminPermissions,
  hasAdminPermission,
};

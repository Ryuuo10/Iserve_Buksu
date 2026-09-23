export const ADMIN_PERMISSION_GROUPS = [
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

export const DEFAULT_ADMIN_PERMISSIONS = [
  'dashboard.view',
  'grievances.view',
  'grievances.edit',
  'notifications.view',
  'analytics.view',
];

export const normalizeAdminPermissions = (permissions = []) => {
  const knownPermissions = new Set(
    ADMIN_PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id))
  );

  if (!Array.isArray(permissions)) {
    return [];
  }

  return [...new Set(
    permissions
      .map((permission) => String(permission || '').trim())
      .filter((permission) => knownPermissions.has(permission))
  )];
};

export const getEffectiveAdminPermissions = (user) => {
  if (!user || user.role !== 'admin') {
    return [];
  }

  if (!Array.isArray(user.permissions)) {
    return [...DEFAULT_ADMIN_PERMISSIONS];
  }

  return normalizeAdminPermissions(user.permissions);
};

export const hasAdminPermission = (user, permission) => {
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

const ADMIN_TAB_RULES = {
  dashboard: {
    anyOf: ['dashboard.view'],
  },
  grievances: {
    anyOf: ['grievances.view'],
  },
  notifications: {
    anyOf: ['notifications.view'],
  },
  users: {
    anyOf: ['users.manage'],
  },
  offices: {
    anyOf: ['offices.manage'],
  },
  analytics: {
    anyOf: ['analytics.view'],
  },
  'admin-manage': {
    superadminOnly: true,
  },
  settings: {
    public: true,
  },
  profile: {
    public: true,
  },
};

export const canAccessAdminTab = (user, tabId) => {
  const rule = ADMIN_TAB_RULES[tabId];

  if (!rule) {
    return false;
  }

  if (rule.public) {
    return true;
  }

  if (rule.superadminOnly) {
    return user?.role === 'superadmin';
  }

  if (!user) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  if (user.role !== 'admin') {
    return false;
  }

  return (rule.anyOf || []).some((permission) => hasAdminPermission(user, permission));
};

export const getAccessibleAdminTabs = (user) => (
  ['dashboard', 'grievances', 'notifications', 'users', 'offices', 'analytics', 'admin-manage', 'settings', 'profile']
    .filter((tabId) => canAccessAdminTab(user, tabId))
);

export const getPermissionLabel = (permissionId) => (
  ADMIN_PERMISSION_GROUPS
    .flatMap((group) => group.permissions)
    .find((permission) => permission.id === permissionId)?.label || permissionId
);

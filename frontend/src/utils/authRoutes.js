const LOGIN_ROUTE_BY_ROLE = {
  admin: '/',
  superadmin: '/',
  office_handler: '/',
  office: '/',
  complainant: '/',
};

const DASHBOARD_ROUTE_BY_ROLE = {
  admin: '/admin',
  superadmin: '/admin',
  office_handler: '/office',
  complainant: '/complainant',
};

export const getLoginRouteForRole = (role) => LOGIN_ROUTE_BY_ROLE[role] || '/';

export const getDashboardRouteForRole = (role) => DASHBOARD_ROUTE_BY_ROLE[role] || '/';

export const getLoginRouteForAllowedRoles = (allowedRoles = []) => {
  const normalizedRoles = [...new Set(
    (Array.isArray(allowedRoles) ? allowedRoles : [])
      .filter(Boolean)
      .map((role) => (role === 'superadmin' ? 'admin' : role))
  )];

  if (normalizedRoles.length !== 1) {
    return '/';
  }

  return getLoginRouteForRole(normalizedRoles[0]);
};

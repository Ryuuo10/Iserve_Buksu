import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import { getLoginRouteForAllowedRoles, getLoginRouteForRole } from '../utils/authRoutes';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const location = useLocation();
  const [state, setState] = useState({
    loading: true,
    user: null,
    authenticated: false,
  });

  useEffect(() => {
    let isMounted = true;

    const verifyAccess = async () => {
      const token = authService.getToken();
      if (!token) {
        if (isMounted) {
          setState({ loading: false, user: null, authenticated: false });
        }
        return;
      }

      let user = authService.getUser();
      if (!user) {
        user = await authService.hydrateUser();
      } else {
        const requiresHydration =
          user.role === 'complainant'
            ? user.complainantType === undefined
            : user.role === 'office_handler'
              ? user.office === undefined || user.isVerified === undefined
              : false;

        if (requiresHydration) {
          user = (await authService.hydrateUser()) || user;
        }
      }

      if (!isMounted) {
        return;
      }

      if (!user) {
        setState({ loading: false, user: null, authenticated: false });
        return;
      }

      setState({ loading: false, user, authenticated: true });
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const fallbackLoginRoute = getLoginRouteForAllowedRoles(allowedRoles);

  if (!state.authenticated || !state.user) {
    return <Navigate to={fallbackLoginRoute} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(state.user.role)) {
    return <Navigate to={getLoginRouteForRole(state.user.role)} replace />;
  }

  if (state.user.role === 'office_handler' && state.user.isVerified === false) {
    return <Navigate to="/pending-verification" replace />;
  }

  const needsProfileCompletion =
    (state.user.role === 'office_handler' && !state.user.office) ||
    (state.user.role === 'complainant' && !state.user.complainantType);

  if (needsProfileCompletion && location.pathname !== '/profile-completion') {
    return <Navigate to="/profile-completion" replace />;
  }

  return children;
};

export default ProtectedRoute;

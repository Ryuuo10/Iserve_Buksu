import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import authService from '../services/authService';
import API_BASE_URL from '../config/api';
import { getLoginRouteForAllowedRoles, getLoginRouteForRole } from '../utils/authRoutes';

function ProtectedRouteWithProfile({ children, allowedRoles = [] }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      const token = authService.getToken();
      const user = authService.getUser();
      const fallbackLoginRoute = user?.role
        ? getLoginRouteForRole(user.role)
        : getLoginRouteForAllowedRoles(allowedRoles);

      if (!token || !user) {
        navigate(fallbackLoginRoute);
        return;
      }

      try {
        // Verify token is still valid
        const response = await axios.get(`${API_BASE_URL}/profile/completion-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.success) {
          // Check role permissions
          if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            navigate(getLoginRouteForRole(user.role));
            return;
          }

          // Check if profile completion is needed
          if (response.data.needsCompletion) {
            navigate('/profile-completion');
            return;
          }

          setAuthenticated(true);
        } else {
          navigate(fallbackLoginRoute);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        authService.logout();
        navigate(fallbackLoginRoute);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndProfile();
  }, [navigate, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return authenticated ? children : null;
}

export default ProtectedRouteWithProfile;

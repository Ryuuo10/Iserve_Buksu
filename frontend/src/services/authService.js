import axios from 'axios';
import API_BASE_URL from '../config/api';

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Hybrid session storage: sessionStorage for per-tab isolation
// sessionStorage is NOT shared between tabs on the same domain
const SessionStorage = {
  setItem: (key, value) => {
    sessionStorage.setItem(key, value);
  },
  getItem: (key) => {
    return sessionStorage.getItem(key);
  },
  removeItem: (key) => {
    sessionStorage.removeItem(key);
  },
  clear: () => {
    sessionStorage.clear();
  }
};

const CLIENT_SESSION_KEY = 'clientSessionId';
const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/auth/google-signin',
  '/auth/google-office-setup',
  '/auth/google-complainant-setup',
  '/auth/check-email',
  '/auth/login',
  '/auth/signup',
  '/auth/offices',
]);

const getClientSessionId = () => {
  let sessionId = SessionStorage.getItem(CLIENT_SESSION_KEY);

  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    SessionStorage.setItem(CLIENT_SESSION_KEY, sessionId);
  }

  return sessionId;
};

// Add axios interceptor to include token in all requests
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from sessionStorage (per-tab) rather than localStorage (shared)
    const token = SessionStorage.getItem('authToken') || SessionStorage.getItem('token');
    
    // Backward-compatibility: migrate legacy "token" key to "authToken"
    if (!SessionStorage.getItem('authToken') && SessionStorage.getItem('token')) {
      SessionStorage.setItem('authToken', SessionStorage.getItem('token'));
      SessionStorage.removeItem('token');
    }
    
    const requestPath = typeof config.url === 'string' ? config.url.split('?')[0] : '';
    const isPublicAuthEndpoint = PUBLIC_AUTH_ENDPOINTS.has(requestPath);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`📤 Sending request with Bearer token to ${config.url}`);
    } else if (!isPublicAuthEndpoint) {
      console.warn(`⚠️ No token found in sessionStorage for request to ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token may have expired');
      // Optionally clear token and redirect to login
      // authService.logout();
      // window.location.href = '/login';
    }
    
    if (error.response?.status === 403) {
      console.error('❌ 403 Forbidden - Access denied');
    }
    
    return Promise.reject(error);
  }
);

const authService = {
  // Google Sign-In
  googleSignIn: async (token, selectedRole, recaptchaToken = null) => {
    try {
      const requestBody = { token };

      if (selectedRole) {
        requestBody.selectedRole = selectedRole;
      }
      
      // Add reCAPTCHA token if provided
      if (recaptchaToken) {
        requestBody.recaptchaToken = recaptchaToken;
      }
      
      const response = await axiosInstance.post(`/auth/google-signin`, requestBody);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  completeGoogleOfficeSetup: async (token, office) => {
    try {
      const response = await axiosInstance.post(`/auth/google-office-setup`, {
        token,
        office,
      });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  completeGoogleComplainantSetup: async (token, complainantType) => {
    try {
      const response = await axiosInstance.post(`/auth/google-complainant-setup`, {
        token,
        complainantType,
      });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Check if email exists
  checkEmail: async (email) => {
    try {
      const response = await axiosInstance.post(`/auth/check-email`, {
        email,
      });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Get all offices (for admin panel)
  getOffices: async () => {
    try {
      const response = await axiosInstance.get(`/auth/offices`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Add new office (admin only)
  addOffice: async (officeData) => {
    try {
      const response = await axiosInstance.post(`/auth/offices`, officeData);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Get all office handlers (pending + verified)
  getOfficeHandlers: async () => {
    try {
      const response = await axiosInstance.get(`/offices/handlers`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Verify an office handler
  verifyOfficeHandler: async (userId) => {
    try {
      const response = await axiosInstance.put(`/offices/handlers/${userId}/verify`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Reject an office handler
  rejectOfficeHandler: async (userId, reason) => {
    try {
      const response = await axiosInstance.post(`/offices/handlers/${userId}/reject`, { reason });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Get office categories
  getOfficeCategories: async () => {
    try {
      const response = await axiosInstance.get(`/offices/categories`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Create office category
  createOfficeCategory: async (name) => {
    try {
      const response = await axiosInstance.post(`/offices/categories`, { name });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Update office category name
  updateOfficeCategory: async (categoryId, name) => {
    try {
      const response = await axiosInstance.put(`/offices/categories/${categoryId}`, { name });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Delete office category
  deleteOfficeCategory: async (categoryId) => {
    try {
      const response = await axiosInstance.delete(`/offices/categories/${categoryId}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Update office handler's category
  updateOfficeHandler: async (userId, office) => {
    try {
      const response = await axiosInstance.put(`/offices/handlers/${userId}`, { office });
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Delete office handler account
  deleteOfficeHandler: async (userId) => {
    try {
      const response = await axiosInstance.delete(`/offices/handlers/${userId}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error',
      };
    }
  },

  // Get user profile (fetches fresh data from backend)
  getProfile: async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axiosInstance.get(`/auth/profile`);
      
      return response.data;
    } catch (error) {
      // Handle token expiration or invalid token
      if (error.response?.status === 401) {
        authService.logout();
      }
      return error.response?.data || {
        success: false,
        message: 'Failed to fetch profile'
      };
    }
  },

  // Restore the cached user from the backend when a token exists
  hydrateUser: async () => {
    const token = authService.getToken();
    if (!token) {
      return null;
    }

    const profileResponse = await authService.getProfile();
    if (profileResponse?.success && profileResponse.user) {
      authService.setUser(profileResponse.user);
      return profileResponse.user;
    }

    return null;
  },

  // Validate token with backend
  validateToken: async () => {
    try {
      const token = authService.getToken();
      if (!token) return false;
      
      const response = await axiosInstance.get(`/protected/protected`);
      
      return response.data.success;
    } catch {
      // Token is invalid, clean up
      authService.logout();
      return false;
    }
  },

  // Store JWT token in sessionStorage (per-tab isolation)
  setToken: (token) => {
    SessionStorage.setItem('authToken', token);
    SessionStorage.removeItem('token');
    console.log('✅ Token stored in sessionStorage (tab-isolated)');
  },

  // Get JWT token from sessionStorage (per-tab isolation)
  getToken: () => {
    const authToken = SessionStorage.getItem('authToken');
    if (authToken) return authToken;

    // Backward-compatibility for sessions that still have "token"
    const legacyToken = SessionStorage.getItem('token');
    if (legacyToken) {
      SessionStorage.setItem('authToken', legacyToken);
      SessionStorage.removeItem('token');
      return legacyToken;
    }

    return null;
  },

  // Clear token from sessionStorage (per-tab)
  clearToken: () => {
    SessionStorage.removeItem('authToken');
    SessionStorage.removeItem('token');
  },

  // Store user data in sessionStorage (per-tab isolation)
  setUser: (user) => {
    const normalizedUser = user?._id
      ? user
      : user?.id
        ? { ...user, _id: user.id }
        : user;

    SessionStorage.setItem('user', JSON.stringify(normalizedUser));
    if (normalizedUser?._id) {
      SessionStorage.setItem('userId', normalizedUser._id);
    }
    if (normalizedUser?.role) {
      SessionStorage.setItem('userRole', normalizedUser.role);
    }
    console.log('✅ User data stored in sessionStorage (tab-isolated)');
  },

  // Get user data from sessionStorage (per-tab isolation)
  getUser: () => {
    const user = SessionStorage.getItem('user');
    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user);
    } catch (error) {
      console.error('Failed to parse cached user data:', error);
      SessionStorage.removeItem('user');
      return null;
    }
  },

  // Update user data (merge with existing data) in sessionStorage
  updateUser: (userData) => {
    const currentUser = authService.getUser();
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      SessionStorage.setItem('user', JSON.stringify(updatedUser));
      if (updatedUser._id) SessionStorage.setItem('userId', updatedUser._id);
      if (updatedUser.role) SessionStorage.setItem('userRole', updatedUser.role);
      return updatedUser;
    }
    return null;
  },

  getClientSessionId,

  // Logout - Clear auth from this tab only
  logout: async () => {
    try {
      const token = SessionStorage.getItem('authToken') || SessionStorage.getItem('token');
      
      // Call backend logout endpoint if token exists
      if (token) {
        try {
          await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (error) {
          console.warn('Backend logout call failed, proceeding with local cleanup:', error.message);
        }
      }
    } catch (error) {
      console.warn('Error in logout:', error);
    } finally {
      // Clear all auth data from sessionStorage (this tab only)
      SessionStorage.removeItem('authToken');
      SessionStorage.removeItem('token');
      SessionStorage.removeItem('user');
      SessionStorage.removeItem('userId');
      SessionStorage.removeItem('userRole');
      
      console.log('✅ Logout completed for this tab (sessionStorage cleared)');
    }
  },
};

export default authService;
export { axiosInstance };

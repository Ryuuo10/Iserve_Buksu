import { axiosInstance } from './authService';

const buildAxiosUrl = (baseURL = '', url = '') => {
  const normalizedBase = String(baseURL || '').replace(/\/+$/, '');
  const normalizedUrl = String(url || '');

  if (/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }

  return `${normalizedBase}${normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`}`;
};

const adminService = {
  // =====================================================
  // ADMIN USERS MANAGEMENT
  // =====================================================
  
  // Get all admin users
  getAdminUsers: async () => {
    try {
      console.log('Fetching admin users...');
      const response = await axiosInstance.get('/admin/users');
      console.log('Admin users fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('Get admins error:', error.response?.data || error.message);
      return error.response?.data || {
        success: false,
        message: error.message || 'Network error'
      };
    }
  },

  // Create new admin user
  createAdminUser: async (name, email, password, permissions = []) => {
    try {
      console.log('Creating admin user:', { name, email });
      const response = await axiosInstance.post('/admin/users', {
        name,
        email,
        password,
        permissions,
      });
      console.log('Admin user created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Admin creation error:', error.response?.data || error.message);
      return error.response?.data || {
        success: false,
        message: error.message || 'Network error'
      };
    }
  },

  // Update admin user
  updateAdminUser: async (adminId, name, password = null, permissions = undefined) => {
    try {
      const payload = { name };
      if (password) {
        payload.password = password;
      }
      if (permissions !== undefined) {
        payload.permissions = permissions;
      }
      const response = await axiosInstance.put(`/admin/users/${adminId}`, payload);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  // Delete admin user
  deleteAdminUser: async (adminId) => {
    try {
      const response = await axiosInstance.delete(`/admin/users/${adminId}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  // =====================================================
  // SYSTEM SETTINGS
  // =====================================================

  // Get system settings
  getSystemSettings: async () => {
    try {
      const response = await axiosInstance.get('/admin/settings');
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  // Update system settings
  updateSystemSettings: async (settings) => {
    try {
      const response = await axiosInstance.post('/admin/settings', settings);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  exportGrievances: async ({
    search = '',
    status = '',
    priority = '',
    category = '',
    office = '',
    archived = '',
    grievanceView = '',
    overdueMemoStatus = '',
    startDate = '',
    endDate = '',
    month = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    format = 'csv',
  } = {}) => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (category) params.append('category', category);
      if (office) params.append('office', office);
      if (archived) params.append('archived', archived);
      if (grievanceView) params.append('grievanceView', grievanceView);
      if (overdueMemoStatus) params.append('overdueMemoStatus', overdueMemoStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (month) params.append('month', month);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      params.append('format', format);

      const response = await axiosInstance.get(`/admin/grievances/export?${params.toString()}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      return Promise.reject(error);
    }
  },

  markOverdueMemoCreated: async (grievanceId) => {
    const normalizedId = String(grievanceId || '').trim();

    if (!normalizedId) {
      return Promise.reject({
        status: null,
        message: 'Cannot record overdue memo: grievance ID is missing.',
      });
    }

    const requestUrl = `/admin/grievances/${normalizedId}/overdue-memo`;

    console.info('Mark overdue memo request', {
      grievanceId: normalizedId,
      baseURL: axiosInstance.defaults.baseURL,
      requestUrl,
      finalUrl: buildAxiosUrl(axiosInstance.defaults.baseURL, requestUrl),
      method: 'PUT',
    });

    try {
      const response = await axiosInstance.put(requestUrl);
      return response.data;
    } catch (error) {
      const serverMessage = error.response?.data?.message;
      const status = error.response?.status;
      const message = serverMessage || error.message || 'Failed to record overdue memo creation';
      return Promise.reject({
        ...error,
        status,
        message,
        response: error.response,
      });
    }
  },

  // =====================================================
  // AUDIT LOGS
  // =====================================================

  // Get audit logs
  getAuditLogs: async ({ type = '', startDate = '', endDate = '', limit = 20, skip = 0 } = {}) => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', String(limit));
      params.append('skip', String(skip));

      const response = await axiosInstance.get(`/admin/audit-logs?${params.toString()}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  // Get audit logs statistics
  getAuditLogsStats: async ({ type = '', startDate = '', endDate = '' } = {}) => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const query = params.toString();
      const response = await axiosInstance.get(`/admin/audit-logs/stats${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  },

  // Export audit logs
  exportAuditLogs: async ({ type = '', startDate = '', endDate = '' } = {}) => {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const query = params.toString();
      const response = await axiosInstance.get(`/admin/audit-logs/export${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error) {
      return error.response?.data || {
        success: false,
        message: 'Network error'
      };
    }
  }
};

export default adminService;

import React, { useEffect, useState } from 'react';
import adminService from '../../services/adminService';

const defaultSettings = {
  systemName: 'BukSU Grievance System',
  maintenanceMode: false,
  emailNotifications: true,
  maxGrievancesPerUser: 5,
  grievanceExpiryDays: 90,
  updatedAt: null,
  updatedBy: null,
};

const SystemSettingsModule = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminService.getSystemSettings();
      if (response.success) {
        setSettings((prev) => ({ ...prev, ...(response.data || {}) }));
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to fetch settings' });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setMessage({ type: 'error', text: 'Failed to fetch settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleSave = async () => {
    if (!String(settings.systemName || '').trim()) {
      setMessage({ type: 'error', text: 'System name is required' });
      return;
    }

    if (Number(settings.maxGrievancesPerUser) < 1 || Number(settings.grievanceExpiryDays) < 1) {
      setMessage({ type: 'error', text: 'Numeric settings must be at least 1' });
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.updateSystemSettings({
        systemName: String(settings.systemName).trim(),
        maintenanceMode: !!settings.maintenanceMode,
        emailNotifications: !!settings.emailNotifications,
        maxGrievancesPerUser: Number(settings.maxGrievancesPerUser),
        grievanceExpiryDays: Number(settings.grievanceExpiryDays),
      });

      if (response.success) {
        setSettings((prev) => ({ ...prev, ...(response.data || {}) }));
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const formattedUpdatedAt = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleString()
    : 'Not updated yet';
  const updatedByText = settings.updatedBy?.name
    ? `${settings.updatedBy.name} (${settings.updatedBy.email})`
    : 'System default';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
        <p className="text-gray-600 mt-1">Configure system-wide settings and parameters</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">System Name</label>
          <input
            type="text"
            name="systemName"
            value={settings.systemName}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">The name displayed throughout the system</p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Notifications</label>
            <p className="text-xs text-gray-500 mt-1">Global email notification toggle for future outbound messaging controls</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="emailNotifications"
              checked={settings.emailNotifications}
              onChange={handleInputChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700">Maintenance Mode</label>
            <p className="text-xs text-gray-500 mt-1">Blocks complainant and office-handler access while still allowing admin and superadmin access</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={handleInputChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Active Grievances Per User</label>
          <input
            type="number"
            name="maxGrievancesPerUser"
            value={settings.maxGrievancesPerUser}
            onChange={handleInputChange}
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Applies to open complainant grievances waiting for resolution</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Grievance Expiry (Days)</label>
          <input
            type="number"
            name="grievanceExpiryDays"
            value={settings.grievanceExpiryDays}
            onChange={handleInputChange}
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Saved now and ready for later automation work</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Current Configuration</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>System: {settings.systemName}</li>
            <li>Email Notifications: {settings.emailNotifications ? 'Enabled' : 'Disabled'}</li>
            <li>Maintenance Mode: {settings.maintenanceMode ? 'Active' : 'Inactive'}</li>
          </ul>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-2">Audit Metadata</h3>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>Max Active Grievances: {settings.maxGrievancesPerUser}</li>
            <li>Expiry Period: {settings.grievanceExpiryDays} days</li>
            <li>Last Updated: {formattedUpdatedAt}</li>
            <li>Updated By: {updatedByText}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModule;

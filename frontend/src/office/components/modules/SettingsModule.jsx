import { useState } from 'react';
import { getOfficePreferences, OFFICE_PREFERENCE_DEFAULTS, saveOfficePreferences } from '../../utils/preferences';

const tabs = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'queue', label: 'Queue Controls' },
];

export const SettingsModule = () => {
  const [activeTab, setActiveTab] = useState('workspace');
  const [preferences, setPreferences] = useState(() => getOfficePreferences());
  const [savedMessage, setSavedMessage] = useState('');

  const updatePreference = (field, value) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const nextPreferences = saveOfficePreferences(preferences);
    setPreferences(nextPreferences);
    window.dispatchEvent(new CustomEvent('office-system-settings-updated', { detail: nextPreferences }));
    setSavedMessage('Office system settings saved.');
    window.setTimeout(() => setSavedMessage(''), 3000);
  };

  const handleReset = () => {
    setPreferences({ ...OFFICE_PREFERENCE_DEFAULTS });
  };

  return (
    <div className="space-y-6">
      {savedMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {savedMessage}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-500">System Controls</p>
        <h2 className="mt-2 text-3xl font-bold text-gray-900">Office workspace settings</h2>
        <p className="mt-2 text-sm text-gray-600">
          Control how the office panel behaves for this user, including startup behavior, notification polling, and queue defaults.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex space-x-8 mb-8 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'workspace' && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Default Startup Module</label>
              <select
                value={preferences.defaultTab}
                onChange={(event) => updatePreference('defaultTab', event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="dashboard">Dashboard</option>
                <option value="grievances">My Grievances</option>
                <option value="resolution-reports">Resolution Reports</option>
              </select>
              <p className="mt-2 text-sm text-gray-500">Choose which module opens first when this office user enters the panel.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Dashboard Auto Refresh</label>
              <select
                value={preferences.dashboardRefreshSeconds}
                onChange={(event) => updatePreference('dashboardRefreshSeconds', Number(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value={0}>Off</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={120}>Every 2 minutes</option>
              </select>
              <p className="mt-2 text-sm text-gray-500">Applies to live dashboard metrics and recent grievance activity.</p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Notification Refresh Interval</label>
              <select
                value={preferences.notificationRefreshSeconds}
                onChange={(event) => updatePreference('notificationRefreshSeconds', Number(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value={15}>Every 15 seconds</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={120}>Every 2 minutes</option>
              </select>
              <p className="mt-2 text-sm text-gray-500">Controls how often the top bar checks for new notifications.</p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="block text-sm font-semibold text-gray-900 mb-3">Sound Alert for New Notifications</p>
              <label className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-4 border border-gray-200">
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Play a short sound when new unread notifications arrive</p>
                  <p className="text-xs text-gray-500 mt-1">Useful if the office tab stays open during working hours.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePreference('soundAlerts', !preferences.soundAlerts)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    preferences.soundAlerts ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      preferences.soundAlerts ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Default Queue Page Size</label>
              <select
                value={preferences.queuePageSize}
                onChange={(event) => updatePreference('queuePageSize', Number(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value={10}>10 cases</option>
                <option value={25}>25 cases</option>
                <option value={50}>50 cases</option>
              </select>
              <p className="mt-2 text-sm text-gray-500">Used as the default list size when opening the grievance queue.</p>
            </div>

            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">Applies To</p>
              <ul className="mt-4 space-y-2 text-sm text-indigo-900">
                <li>Office dashboard startup behavior</li>
                <li>Top bar notification polling</li>
                <li>Queue default page size</li>
                <li>Live dashboard refresh timing</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Save System Controls
          </button>
        </div>
      </div>
    </div>
  );
};

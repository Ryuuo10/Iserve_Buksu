import { useState, useEffect } from 'react';
import { MenuIcon } from '../icons';
import AdminNotificationsBell from './AdminNotificationsBell';
import { canAccessAdminTab } from '../../utils/adminPermissions';

const getTabDisplayName = (tabId) => {
  const tabNames = {
    dashboard: 'Dashboard',
    grievances: 'Grievance Manage',
    users: 'Manage User',
    offices: 'Office Manage',
    analytics: 'Analytics',
    notifications: 'Notifications',
    'admin-manage': 'Admin Manage',
    settings: 'Settings',
    profile: 'Profile'
  };

  return tabNames[tabId] || tabId.replace('-', ' ');
};

const TopBar = ({ activeTab, setSidebarOpen, setActiveTab, userInfo = null }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 mr-4 menu-button"
          >
            <MenuIcon />
          </button>
          <h1 className="text-xl font-bold text-gray-900 capitalize">
            {getTabDisplayName(activeTab)}
          </h1>
        </div>
        <div className="flex items-center space-x-6">
          {/* Date & Time */}
          <div className="hidden sm:flex items-center space-x-3 text-gray-600">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">{formatDate(currentTime)}</span>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm font-semibold text-gray-700">{formatTime(currentTime)}</span>
          </div>
          {canAccessAdminTab(userInfo, 'notifications') && (
            <AdminNotificationsBell onViewAll={() => setActiveTab('notifications')} />
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;

import { useState, useEffect, useRef, useCallback } from 'react';
import { MenuIcon, BellIcon } from '../icons';
import authService, { axiosInstance } from '../../services/authService';

const TopBar = ({ activeTab, sidebarOpen, setSidebarOpen, setActiveTab }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await authService.getProfile();
        if (response.success) {
          setUserInfo(response.user);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/notifications');
      if (response.data?.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const timeAgo = (date) => {
    const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const markAsRead = async (id) => {
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.put('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-3 py-3 shadow-sm sm:px-6 sm:py-4 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="menu-button mr-2 rounded-lg p-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 lg:hidden sm:mr-4"
          >
            <MenuIcon />
          </button>
          
          {/* Role title with bounce effect */}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-blue-600 sm:text-xl" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}>
              COMPLAINANT
            </h1>
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400 sm:text-xs sm:tracking-[0.18em]">
              {String(activeTab || 'dashboard').replaceAll('-', ' ')}
            </p>
          </div>
        </div>
        
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* Notifications */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => {
                setDropdownOpen((open) => !open);
                if (!dropdownOpen) fetchNotifications();
              }}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200 relative"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <div className="fixed left-3 right-3 top-16 z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                    <p className="text-xs text-gray-500">{unreadCount} unread</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab('notifications');
                        setDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      View all
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-gray-500">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification._id}
                        onClick={() => {
                          if (!notification.read) {
                            markAsRead(notification._id);
                          }
                          setActiveTab('notifications');
                          setDropdownOpen(false);
                          setSidebarOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          notification.read ? 'bg-white' : 'bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`truncate text-sm ${notification.read ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
                                {notification.title}
                              </p>
                              {!notification.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{notification.message}</p>
                            <p className="mt-1 text-[11px] text-gray-400">{timeAgo(notification.createdAt)}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* User avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity duration-200">
            {loading ? (
              <div className="w-4 h-4 bg-white/30 rounded-full animate-pulse"></div>
            ) : userInfo?.name ? (
              userInfo.name.charAt(0).toUpperCase()
            ) : (
              'CU'
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;

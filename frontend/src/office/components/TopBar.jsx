import { useCallback, useEffect, useRef, useState } from "react";
import { MenuIcon, BellIcon } from "../icons";
import authService, { axiosInstance } from "../../services/authService";
import { formatNotificationMessage } from "../../utils/notificationFormatting";
import { getOfficePreferences } from "../utils/preferences";

const getTabDisplayName = (tabId) => {
  const tabNames = {
    dashboard: "Dashboard",
    grievances: "My Grievances",
    "resolution-reports": "Resolution Reports",
    profile: "Profile",
    offices: "Offices",
    settings: "Settings",
    notifications: "Notifications",
  };
  return tabNames[tabId] || tabId.charAt(0).toUpperCase() + tabId.slice(1);
};

export const TopBar = ({ activeTab, sidebarOpen, setSidebarOpen, setActiveTab }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [officeLabel, setOfficeLabel] = useState("Assigned Office");
  const [preferences, setPreferences] = useState(() => getOfficePreferences());
  const bellRef = useRef(null);
  const previousUnreadCountRef = useRef(0);

  const formatOfficeLabel = useCallback((officeValue, categories = []) => {
    if (!officeValue) {
      return "Assigned Office";
    }

    const matchedCategory = categories.find((category) =>
      category.id === officeValue || category.name === officeValue
    );

    if (matchedCategory?.name) {
      return matchedCategory.name;
    }

    return String(officeValue)
      .replaceAll("_", " ")
      .toUpperCase();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/notifications");
      if (response.data?.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, []);

  const loadOfficeLabel = useCallback(async () => {
    try {
      const cachedUser = authService.getUser();
      const initialOffice = cachedUser?.office || "";

      const [profileResponse, officesResponse] = await Promise.all([
        authService.getProfile(),
        authService.getOffices(),
      ]);

      const nextOffice = profileResponse?.success
        ? profileResponse.user?.office || initialOffice
        : initialOffice;
      const categories = officesResponse?.success ? (officesResponse.offices || []) : [];

      setOfficeLabel(formatOfficeLabel(nextOffice, categories));
    } catch {
      const cachedUser = authService.getUser();
      setOfficeLabel(formatOfficeLabel(cachedUser?.office || ""));
    }
  }, [formatOfficeLabel]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePreferencesUpdated = (event) => {
      if (event.detail) {
        setPreferences(event.detail);
      }
    };

    window.addEventListener('office-system-settings-updated', handlePreferencesUpdated);
    return () => window.removeEventListener('office-system-settings-updated', handlePreferencesUpdated);
  }, []);

  useEffect(() => {
    loadOfficeLabel();
  }, [loadOfficeLabel]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchNotifications();
    }, 0);
    const intervalMs = Math.max(15, Number(preferences.notificationRefreshSeconds || 30)) * 1000;
    const interval = setInterval(fetchNotifications, intervalMs);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchNotifications, preferences.notificationRefreshSeconds]);

  useEffect(() => {
    if (!preferences.soundAlerts) {
      previousUnreadCountRef.current = unreadCount;
      return;
    }

    if (unreadCount > previousUnreadCountRef.current && typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.03;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
      } catch {
        // silent
      }
    }

    previousUnreadCountRef.current = unreadCount;
  }, [preferences.soundAlerts, unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

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
      await axiosInstance.put("/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Menu button and page title */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                console.log('Menu button clicked, sidebarOpen was:', sidebarOpen);
                setSidebarOpen(!sidebarOpen);
                console.log('sidebarOpen is now:', !sidebarOpen);
              }}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 menu-button"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            
            <div className="text-left">
              <h1 className="text-xl font-bold text-gray-900">
                {getTabDisplayName(activeTab)}
              </h1>
            </div>
          </div>

          {/* Right side - Notifications and user menu */}
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Office Category
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {officeLabel}
              </p>
            </div>

            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => {
                  setDropdownOpen((open) => !open);
                  if (!dropdownOpen) fetchNotifications();
                }}
                className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
              >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                      <p className="text-xs text-gray-500">{unreadCount} unread</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                          Mark all as read
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActiveTab("notifications");
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
                      <div className="px-4 py-10 text-center text-sm text-gray-500">No notifications yet.</div>
                    ) : (
                      notifications.slice(0, 8).map((notification) => (
                        <button
                          key={notification._id}
                          onClick={() => {
                            if (!notification.read) {
                              markAsRead(notification._id);
                            }
                            setActiveTab("notifications");
                            setDropdownOpen(false);
                            setSidebarOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                            notification.read ? "bg-white" : "bg-blue-50/50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`truncate text-sm ${notification.read ? "font-medium text-gray-800" : "font-semibold text-gray-900"}`}>
                                {notification.title}
                              </p>
                              {!notification.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{formatNotificationMessage(notification)}</p>
                            <p className="mt-1 text-[11px] text-gray-400">{timeAgo(notification.createdAt)}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "../icons";
import { axiosInstance } from "../../services/authService";
import { formatNotificationMessage } from "../../utils/notificationFormatting";
import { useRealTimeNotifications } from "../../hooks/useRealTime";

const mergeNotifications = (currentNotifications, incomingNotifications) => {
  const notificationsById = new Map(
    currentNotifications.map((notification) => [notification._id, notification])
  );

  incomingNotifications.forEach((notification) => {
    if (!notification?._id) {
      return;
    }

    const existingNotification = notificationsById.get(notification._id) || {};
    notificationsById.set(notification._id, { ...existingNotification, ...notification });
  });

  return Array.from(notificationsById.values()).sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  );
};

const timeAgo = (date, now) => {
  const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const AdminNotificationsBell = ({ onViewAll }) => {
  const {
    unreadCount: realTimeUnreadCount,
    notifications: realTimeNotifications,
    setUnreadCount: setRealTimeUnreadCount,
    setNotifications: setRealTimeNotifications,
  } = useRealTimeNotifications();
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const bellRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/notifications");
      if (response.data?.success) {
        setNotifications(response.data.notifications || []);
        setRealTimeUnreadCount(response.data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, [setRealTimeUnreadCount]);

  useEffect(() => {
    fetchNotifications();
    const clockInterval = setInterval(() => setNow(Date.now()), 60000);

    return () => {
      clearInterval(clockInterval);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!realTimeNotifications.length) {
      return;
    }

    setNotifications((prev) => mergeNotifications(prev, realTimeNotifications));
  }, [realTimeNotifications]);

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
      setRealTimeNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
      setRealTimeUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.put("/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setRealTimeNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setRealTimeUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleViewAll = () => {
    setDropdownOpen(false);
    if (typeof onViewAll === "function") {
      onViewAll();
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={() => {
          setDropdownOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              fetchNotifications();
            }
            return nextOpen;
          });
        }}
        className="relative rounded-lg p-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900"
      >
        <BellIcon className="h-6 w-6" />
        {realTimeUnreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white">
            {realTimeUnreadCount > 9 ? "9+" : realTimeUnreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">{realTimeUnreadCount} unread</p>
            </div>
            <div className="flex items-center gap-3">
              {realTimeUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
              <button
                type="button"
                onClick={handleViewAll}
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
                  type="button"
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification._id);
                    }
                    handleViewAll();
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
                    <p className="mt-1 text-[11px] text-gray-400">{timeAgo(notification.createdAt, now)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsBell;

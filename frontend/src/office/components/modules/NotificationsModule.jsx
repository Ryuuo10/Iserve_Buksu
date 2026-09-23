import { useCallback, useEffect, useState } from "react";
import { axiosInstance } from "../../../services/authService";
import { formatNotificationMessage } from "../../../utils/notificationFormatting";

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const typeBadgeClass = (type) => {
  if (type === "office_handler_assignment") return "bg-indigo-100 text-indigo-700";
  if (type === "office_handler_verified") return "bg-emerald-100 text-emerald-700";
  if (type === "office_handler_office_updated") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
};

export const NotificationsModule = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/notifications");
      if (response.data?.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id) => {
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update notification");
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.put("/notifications/read-all");
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update notifications");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6 flex flex-col gap-4 text-left sm:flex-row sm:items-start sm:justify-between">
        <div className="text-left">
          <h2 className="text-3xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-600">Track newly assigned grievances and account updates.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No notifications yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div key={notification._id} className={`p-5 ${notification.read ? "bg-white" : "bg-blue-50/40"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-base ${notification.read ? "font-semibold text-gray-800" : "font-bold text-gray-900"}`}>
                        {notification.title}
                      </h3>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeBadgeClass(notification.type)}`}>
                        {notification.relatedGrievance?.referenceNumber || notification.type.replaceAll("_", " ")}
                      </span>
                      {!notification.read && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                    </div>
                    <p className="text-sm text-gray-600">{formatNotificationMessage(notification)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(notification.createdAt)}</p>
                  </div>
                  {!notification.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(notification._id)}
                      className="self-start rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

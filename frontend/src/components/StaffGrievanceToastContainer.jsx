import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { axiosInstance } from "../services/authService";
import { useRealTimeNotifications } from "../hooks/useRealTime";
import { formatOfficeReference } from "../utils/notificationFormatting";

const STAFF_TOAST_LIMIT = 3;
const ADMIN_GRIEVANCE_TOAST_TITLES = new Set(["New Grievance Received", "Critical Grievance Alert"]);
const OFFICE_GRIEVANCE_TOAST_TITLES = new Set(["New Grievance Assigned"]);

const isStaffGrievanceNotification = (notification, role) => {
  if (!notification?.relatedGrievance || notification.read || notification.seen) {
    return false;
  }

  if (role === "admin" || role === "superadmin") {
    return notification.type === "grievance_submitted" && ADMIN_GRIEVANCE_TOAST_TITLES.has(notification.title);
  }

  if (role === "office_handler") {
    return notification.type === "office_handler_assignment" && OFFICE_GRIEVANCE_TOAST_TITLES.has(notification.title);
  }

  return false;
};

const formatLabel = (value, fallback = "Not specified") => {
  const normalized = String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizePriority = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "urgent" ? "critical" : normalized;
};

const urgencyBadgeClass = (value) => {
  const map = {
    critical: "border-red-200 bg-red-100 text-red-700",
    high: "border-orange-200 bg-orange-100 text-orange-700",
    medium: "border-amber-200 bg-amber-100 text-amber-800",
    low: "border-emerald-200 bg-emerald-100 text-emerald-700",
  };

  return map[normalizePriority(value)] || "border-slate-200 bg-slate-100 text-slate-700";
};

const formatSubmittedAt = (value) => {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const NotificationVisual = () => (
  <div className="staff-notification-visual mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-50 via-blue-50 to-white shadow-[0_18px_45px_-28px_rgba(14,165,233,0.65)] ring-1 ring-cyan-100">
    <div className="staff-notification-document relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-lg ring-1 ring-slate-200">
      <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 3v5h5M8 13h8M8 17h6" />
      </svg>
      <span className="staff-notification-bell absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg ring-4 ring-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" />
        </svg>
      </span>
    </div>
  </div>
);

const ConfettiBurst = () => (
  <div className="staff-notification-confetti" aria-hidden="true">
    {Array.from({ length: 14 }).map((_, index) => (
      <span key={index} />
    ))}
  </div>
);

const makeToastFromNotification = (notification, role) => {
  const grievance = notification.relatedGrievance || {};
  return {
    id: notification._id,
    notificationIds: [notification._id].filter(Boolean),
    kind: "single",
    title: role === "office_handler" ? "New Grievance Assigned" : "New Grievance Received",
    reference: grievance.referenceNumber || "New grievance",
    concern: grievance.subject || formatLabel(grievance.category, "No subject provided"),
    priority: formatLabel(grievance.priority, "Medium"),
    office: grievance.office ? formatOfficeReference(grievance.office) : "",
    submittedAt: grievance.createdAt || notification.createdAt,
    grievanceId: grievance._id,
    role,
  };
};

const makeSummaryToast = (notifications, role) => ({
  id: `summary-${notifications.map((item) => item._id).join("-")}`,
  notificationIds: notifications.map((item) => item._id).filter(Boolean),
  kind: "summary",
  title: `${notifications.length} New Grievances`,
  message:
    role === "office_handler"
      ? `You have ${notifications.length} newly assigned grievance reports requiring your attention.`
      : `You have ${notifications.length} new grievance reports requiring your attention.`,
  role,
});

const makeOverflowSummaryToast = (hiddenToasts, role) => ({
  id: `overflow-${hiddenToasts.flatMap((toast) => toast.notificationIds).join("-")}`,
  notificationIds: hiddenToasts.flatMap((toast) => toast.notificationIds).filter(Boolean),
  kind: "summary",
  title: `${hiddenToasts.length} Additional Grievances`,
  message:
    role === "office_handler"
      ? `${hiddenToasts.length} additional grievance assignments arrived.`
      : `${hiddenToasts.length} additional new grievances arrived.`,
  role,
});

const ToastCard = ({ toast, onClose, onView }) => {
  const isSummary = toast.kind === "summary";

  return (
    <div
      className="staff-notification-card relative w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-white bg-white px-5 py-6 text-center shadow-[0_28px_80px_-34px_rgba(15,23,42,0.65)] ring-1 ring-slate-900/5 sm:px-8 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`staff-grievance-notification-${toast.id}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <ConfettiBurst />

      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Close notification"
      >
        <span className="text-2xl leading-none">&times;</span>
      </button>

      <NotificationVisual />

      <div className="mt-5">
        <h2 id={`staff-grievance-notification-${toast.id}`} className="text-2xl font-bold tracking-normal text-slate-950">
          {isSummary ? toast.title : "New Grievance Received"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {isSummary
            ? toast.message
            : "A new grievance has been submitted and requires your attention."}
        </p>
      </div>

      <div className="mt-6 text-left">
        {!isSummary && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tracking ID</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-950">{toast.reference}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Concern</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-900">{toast.concern}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Urgency</p>
                <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${urgencyBadgeClass(toast.priority)}`}>
                  {toast.priority}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Submitted</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatSubmittedAt(toast.submittedAt)}</p>
              </div>
            </div>
          </div>
        )}

        {toast.office && !isSummary && (
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">{toast.office}</p>
        )}
        {toast.role === "office_handler" && !isSummary && (
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">A new grievance has been assigned to your office.</p>
        )}
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={() => onView(toast)}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-20px_rgba(37,99,235,0.9)] transition hover:bg-blue-700"
        >
          {isSummary ? "View Notifications" : "View Grievance"}
        </button>
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const StaffGrievanceToastContainer = ({ role, onViewGrievance, onViewNotifications }) => {
  const { notifications: realTimeNotifications, setNotifications: setRealTimeNotifications, setUnreadCount } =
    useRealTimeNotifications();
  const [toasts, setToasts] = useState([]);
  const processedIdsRef = useRef(new Set());

  const markSeen = useCallback(async (notificationIds = []) => {
    const ids = notificationIds.filter(Boolean);
    if (!ids.length) {
      return;
    }

    try {
      await axiosInstance.put("/notifications/staff-grievance-seen", { notificationIds: ids });
      setRealTimeNotifications((prev) =>
        prev.map((item) => (ids.includes(item._id) ? { ...item, seen: true, seenAt: new Date().toISOString() } : item))
      );
    } catch {
      // Keep the toast useful even if the seen sync fails temporarily.
    }
  }, [setRealTimeNotifications]);

  const addToasts = useCallback((incomingToasts) => {
    if (!incomingToasts.length) {
      return;
    }

    setToasts((current) => {
      const existingIds = new Set(current.map((toast) => toast.id));
      const fresh = incomingToasts.filter((toast) => !existingIds.has(toast.id));
      const combined = [...fresh, ...current];

      if (combined.length <= STAFF_TOAST_LIMIT) {
        return combined;
      }

      const visible = combined.slice(0, STAFF_TOAST_LIMIT - 1);
      const hidden = combined.slice(STAFF_TOAST_LIMIT - 1);
      return [...visible, makeOverflowSummaryToast(hidden, role)];
    });
  }, [role]);

  useEffect(() => {
    if (!role || role === "complainant") {
      return;
    }

    let active = true;

    const loadUnseen = async () => {
      try {
        const response = await axiosInstance.get("/notifications/staff-grievance-unseen");
        if (!active || !response.data?.success) {
          return;
        }

        const unseen = (response.data.notifications || []).filter((notification) =>
          isStaffGrievanceNotification(notification, role)
        );

        unseen.forEach((notification) => processedIdsRef.current.add(notification._id));

        if (unseen.length === 1) {
          addToasts([makeToastFromNotification(unseen[0], role)]);
        } else if (unseen.length > 1) {
          addToasts([makeSummaryToast(unseen, role)]);
        }

        await markSeen(unseen.map((notification) => notification._id));
      } catch {
        // silent; notification bell still works as fallback
      }
    };

    loadUnseen();

    return () => {
      active = false;
    };
  }, [addToasts, markSeen, role]);

  useEffect(() => {
    const newNotifications = realTimeNotifications.filter((notification) => {
      if (!notification?._id || processedIdsRef.current.has(notification._id)) {
        return false;
      }

      return isStaffGrievanceNotification(notification, role);
    });

    if (!newNotifications.length) {
      return;
    }

    newNotifications.forEach((notification) => processedIdsRef.current.add(notification._id));
    addToasts(newNotifications.map((notification) => makeToastFromNotification(notification, role)));
    markSeen(newNotifications.map((notification) => notification._id));
  }, [addToasts, markSeen, realTimeNotifications, role]);

  const closeToast = (toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const closeLatestToast = useCallback(() => {
    setToasts((current) => current.slice(1));
  }, []);

  useEffect(() => {
    if (!toasts.length) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeLatestToast();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeLatestToast, toasts.length]);

  const handleView = async (toast) => {
    if (toast.kind === "single" && toast.notificationIds[0]) {
      try {
        await axiosInstance.put(`/notifications/${toast.notificationIds[0]}/read`);
        setRealTimeNotifications((prev) =>
          prev.map((item) =>
            item._id === toast.notificationIds[0] ? { ...item, read: true, seen: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Navigation is still more important than this best-effort sync.
      }
    }

    closeToast(toast.id);

    if (toast.kind === "summary") {
      onViewNotifications?.();
      return;
    }

    onViewGrievance?.(toast.grievanceId);
  };

  if (!toasts.length) {
    return null;
  }

  return createPortal(
    <div
      className="staff-notification-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      onMouseDown={closeLatestToast}
    >
      <div className="flex max-h-[90vh] flex-col gap-3 overflow-y-auto">
      {toasts.map((toast) => (
        <div key={toast.id}>
          <ToastCard toast={toast} onClose={closeToast} onView={handleView} />
        </div>
      ))}
      </div>
    </div>,
    document.body
  );
};

export default StaffGrievanceToastContainer;

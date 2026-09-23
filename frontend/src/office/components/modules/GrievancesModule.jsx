import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import authService from "../../../services/authService";
import { useRealTimeGrievances } from "../../../hooks/useRealTime";
import { getOfficePreferences } from "../../utils/preferences";
import API_BASE_URL from "../../../config/api";
import { hasCompleteRcaDetails } from "../../../utils/rcaReport";
import GrievanceStatusTracker from "../../../complainant/components/modules/GrievanceStatusTracker";
import { formatGrievanceStatus, OFFICE_STATUS_LABELS } from "../../../utils/grievanceStatus";
import { normalizeAiCategoryLabel } from "../../../utils/aiAnalysis";
import { getGrievanceSlaStatus } from "../../../utils/grievanceSla";
import ConversationTranscript from "../../../components/ConversationTranscript";
import AttachmentPreviewCard from "../../../components/AttachmentPreviewCard";
import RCAFormModal from "./RCAFormModal";

const API_BASE = `${API_BASE_URL}/offices`;
const OFFICE_SELECTED_GRIEVANCE_KEY = 'office_dashboard_selected_grievance_id';
const ACTIVE_STATUS_OPTIONS = ["assigned_to_department", "in_progress", "resolved", "escalated"];
const ARCHIVE_TYPE_OPTIONS = ["", "monthly_reset", "rejected", "deleted"];
const CASE_REVIEW_STEPS = [
  {
    id: 1,
    title: "Case Progress",
    description: "Status, transcript, handling",
  },
  {
    id: 2,
    title: "Grievance Information",
    description: "Complainant and case details",
  },
  {
    id: 3,
    title: "AI Analysis",
    description: "Summary and insights",
  },
  {
    id: 4,
    title: "Resolution",
    description: "Actions and outcome",
  },
];

const formatArchiveTypeLabel = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "monthly_reset") {
    return "Monthly reset";
  }

  if (normalized === "rejected") {
    return "Rejected archive";
  }

  if (normalized === "deleted") {
    return "Deleted archive";
  }

  return normalized ? normalized.replace(/[_-]+/g, " ") : "Archived";
};

const statusBadge = (status) => {
  const map = {
    pending: "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    assigned_to_department: "bg-cyan-100 text-cyan-800",
    in_progress: "bg-indigo-100 text-indigo-800",
    resolved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    escalated: "bg-purple-100 text-purple-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
};

const priorityBadge = (priority) => {
  const map = {
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
    urgent: "bg-red-100 text-red-700",
    analyzing: "bg-sky-100 text-sky-700",
    unavailable: "bg-rose-100 text-rose-700",
  };
  return map[priority] || "bg-gray-100 text-gray-800";
};

const getQueueItemTone = (grievance, isSelected) => {
  const priority = String(getDisplayPriority(grievance) || "").trim().toLowerCase();
  const isResolved = grievance?.status === "resolved";

  if (isSelected) {
    if (!isResolved && priority === "critical") {
      return "border-red-200 bg-red-50 shadow-[0_10px_30px_-24px_rgba(239,68,68,0.95)]";
    }

    if (!isResolved && priority === "high") {
      return "border-orange-200 bg-orange-50 shadow-[0_10px_30px_-24px_rgba(249,115,22,0.9)]";
    }

    if (!isResolved && priority === "medium") {
      return "border-amber-200 bg-amber-50 shadow-[0_10px_30px_-24px_rgba(245,158,11,0.85)]";
    }

    if (!isResolved && priority === "low") {
      return "border-emerald-200 bg-emerald-50 shadow-[0_10px_30px_-24px_rgba(16,185,129,0.8)]";
    }

    return "border-blue-200 bg-blue-50 shadow-[0_10px_30px_-24px_rgba(59,130,246,0.9)]";
  }

  if (!isResolved && priority === "critical") {
    return "border-red-200 bg-red-50/70 hover:bg-red-100/80";
  }

  if (!isResolved && priority === "high") {
    return "border-orange-200 bg-orange-50/70 hover:bg-orange-100/80";
  }

  if (!isResolved && priority === "medium") {
    return "border-amber-200 bg-amber-50/70 hover:bg-amber-100/80";
  }

  if (!isResolved && priority === "low") {
    return "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80";
  }

  return "border-gray-200 bg-white hover:bg-gray-50";
};

const fmtStatus = (value, context = "default") =>
  formatGrievanceStatus(value, context === "office" ? OFFICE_STATUS_LABELS : undefined);
const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "--");
const SlaBadge = ({ grievance, className = "" }) => {
  const sla = getGrievanceSlaStatus(grievance);

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${sla.className} ${className}`}>
      {sla.label}
    </span>
  );
};
const fmtIncidentDate = (value) => {
  if (!value) {
    return "Not provided by complainant";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

const DETAIL_CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

const formatTextLabel = (value, fallback = "--") => {
  const normalized = String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
};

const getOriginalDescription = (grievance) =>
  String(grievance?.originalDescription || grievance?.description || "").trim();
const getProcessedDescription = (grievance) =>
  String(grievance?.description || "").trim();
const getDisplayProcessedDescription = (grievance) =>
  getProcessedDescription(grievance)
    .split('\n')
    .filter((line) => !/^\s*(Incident Date|Office|Department)\s*:/i.test(line))
    .join('\n')
    .trim();
const hasDistinctProcessedDescription = (grievance) => {
  const original = getOriginalDescription(grievance);
  const processed = getProcessedDescription(grievance);
  return !!(original && processed && original !== processed);
};

const getDisplayPriority = (grievance) => {
  if (!grievance) {
    return "--";
  }

  if (grievance.aiAnalysisStatus === "pending") {
    return "Analyzing";
  }

  if (grievance.aiAnalysisStatus === "failed") {
    return "Unavailable";
  }

  return grievance.aiAnalysis?.urgency?.label || grievance.priority || "--";
};

const getDisplayCategory = (grievance) => {
  if (!grievance) {
    return "--";
  }

  if (grievance.aiAnalysisStatus === "pending") {
    return "Analyzing";
  }

  if (grievance.aiAnalysisStatus === "failed") {
    return "Unavailable";
  }

  return normalizeAiCategoryLabel(grievance.aiAnalysis?.category?.label || grievance.category || "General");
};

const DetailCard = ({ label, title, subtitle, children }) => (
  <div className={`${DETAIL_CARD_CLASS} flex min-h-[210px] flex-col`}>
    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{label}</p>
    <div className="mt-4">
      <p className="break-words text-xl font-bold leading-snug text-slate-950">{title}</p>
      {subtitle && (
        <p className="mt-2 break-words text-sm leading-6 text-slate-500">{subtitle}</p>
      )}
    </div>
    {children && <div className="mt-auto border-t border-slate-200 pt-4">{children}</div>}
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <div className="text-right text-sm font-medium leading-6 text-slate-900">{value}</div>
  </div>
);

const priorityBadgeClass = (priority) => {
  const normalized = String(priority || "").trim().toLowerCase();

  if (["critical", "urgent"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "high") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (normalized === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "low") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

const PriorityDetailBadge = ({ value }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass(value)}`}>
    {formatTextLabel(value)}
  </span>
);

const InfoField = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">{value}</p>
  </div>
);

const CaseReviewStepIndicator = ({ currentStep, onStepChange }) => (
  <div className="border-y border-slate-200 bg-white px-2 py-3">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {CASE_REVIEW_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className="group relative flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-sky-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                isActive
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : isComplete
                    ? "border-sky-300 bg-white text-sky-700"
                    : "border-slate-300 bg-white text-slate-500"
              }`}
            >
              {step.id}
            </span>
            {index < CASE_REVIEW_STEPS.length - 1 && (
              <span className="absolute left-[2.1rem] top-[1.45rem] hidden h-px w-[calc(100%-1rem)] bg-sky-200 md:block" />
            )}
            <span className="relative z-10 min-w-0">
              <span className={`block truncate text-sm font-semibold ${isActive ? "text-sky-900" : "text-slate-700"}`}>
                {step.title}
              </span>
              <span className="mt-0.5 hidden truncate text-xs leading-4 text-slate-500 sm:block">{step.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const CaseReviewPager = ({ currentStep, onStepChange }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
    <button
      type="button"
      onClick={() => onStepChange(Math.max(1, currentStep - 1))}
      disabled={currentStep === 1}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Back
    </button>
    <span className="text-sm font-semibold text-slate-500">Step {currentStep} of 4</span>
    {currentStep < 4 ? (
      <button
        type="button"
        onClick={() => onStepChange(Math.min(4, currentStep + 1))}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
      >
        Next
      </button>
    ) : (
      <span className="w-[4.75rem]" aria-hidden="true" />
    )}
  </div>
);

const SATISFACTION_LABELS = {
  1: "Very Dissatisfied",
  2: "Dissatisfied",
  3: "Neutral",
  4: "Satisfied",
  5: "Very Satisfied",
};

const formatConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(1)}%`;
};

const AiAnalysisPanel = ({ grievance }) => {
  if (!grievance) {
    return null;
  }

  if (grievance.aiAnalysis) {
    const metrics = [
      {
        label: "Complaint Type",
        value: normalizeAiCategoryLabel(grievance.aiAnalysis.category?.label || "--"),
        confidence: formatConfidence(grievance.aiAnalysis.category?.confidence),
        tone: "border-sky-200/90",
      },
      {
        label: "Urgency Level",
        value: grievance.aiAnalysis.urgency?.label || "--",
        confidence: formatConfidence(grievance.aiAnalysis.urgency?.confidence),
        tone: "border-amber-200/90",
      },
      {
        label: "Sentiment",
        value: grievance.aiAnalysis.sentiment?.label || "--",
        confidence: formatConfidence(grievance.aiAnalysis.sentiment?.confidence),
        tone: "border-emerald-200/90",
      },
    ];

    return (
      <div className="rounded-[24px] border border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.92),rgba(255,255,255,0.98))] p-4 shadow-[0_16px_36px_-34px_rgba(59,130,246,0.42)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#2450ff]">AI Analysis</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Generated from your trained complaint-analysis models.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-sky-200 bg-white px-3.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm">
            Model Complete
          </span>
        </div>

        <div className="mt-4 rounded-[20px] border border-sky-100 bg-white/90 p-4 shadow-[0_12px_26px_-28px_rgba(15,23,42,0.42)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Summary</p>
          <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">
            {grievance.aiAnalysis.summary || "The trained models generated the analysis below."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-[18px] border ${metric.tone} bg-white/92 p-3.5 shadow-[0_12px_24px_-30px_rgba(15,23,42,0.45)]`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">{metric.label}</p>
              <p className="mt-2.5 text-[15px] font-semibold capitalize leading-6 text-slate-900">{metric.value}</p>
              <p className="mt-2 text-[13px] text-slate-500">
                {metric.confidence ? `AI Confidence ${metric.confidence}` : "AI confidence unavailable"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (grievance.aiAnalysisStatus === "pending") {
    return (
      <div className={DETAIL_CARD_CLASS}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">AI Analysis</p>
        <p className="mt-4 text-base leading-8 text-slate-800">The trained models are still analyzing this grievance.</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Complaint type, urgency level, summary, and sentiment will appear here once processing finishes.
        </p>
      </div>
    );
  }

  if (grievance.aiAnalysisStatus === "failed") {
    return (
      <div className="rounded-[20px] border border-rose-200 bg-gradient-to-b from-rose-50 to-white p-7 shadow-[0_14px_34px_-28px_rgba(244,63,94,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">AI Analysis</p>
        <p className="mt-4 text-base leading-8 text-rose-900">
          The grievance was saved, but the AI analysis could not be generated yet.
        </p>
        {grievance.aiAnalysisError ? (
          <div className="mt-5 border-t border-rose-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Error Detail</p>
            <p className="mt-2 break-words font-mono text-xs leading-6 text-rose-900">{grievance.aiAnalysisError}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
};

export const GrievancesModule = () => {
  const { latestUpdate } = useRealTimeGrievances();
  const token = authService.getToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const preferences = getOfficePreferences();
  const currentUser = useMemo(() => authService.getUser(), []);
  const currentClientSessionId = useMemo(() => authService.getClientSessionId(), []);

  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [viewMode, setViewMode] = useState("active");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    archiveType: "",
    page: 1,
    limit: preferences.queuePageSize || 10,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showInlineRca, setShowInlineRca] = useState(false);
  const [resolutionNotesDirty, setResolutionNotesDirty] = useState(false);
  const [caseReviewStep, setCaseReviewStep] = useState(1);
  const grievanceRequestIdRef = useRef(0);
  const resolutionNotesDirtyRef = useRef(false);
  const previousSelectedIdRef = useRef("");
  const selectedIdRef = useRef("");

  const selectedGrievance = grievances.find((item) => item._id === selectedId) || grievances[0] || null;
  const currentUserId = String(currentUser?._id || "");
  const isArchivedView = viewMode === "archived";
  const handlingOwner = selectedGrievance?.handlingLockedBy || null;
  const handlingOwnerId = String(handlingOwner?._id || handlingOwner || "");
  const handlingLockSessionId = String(selectedGrievance?.handlingLockSessionId || "");
  const handlingOwnerName =
    handlingOwner?.name ||
    (handlingOwnerId && handlingOwnerId === currentUserId ? currentUser?.name : "") ||
    "No handler claimed yet";
  const isLockedByCurrentUser = Boolean(handlingOwnerId && handlingOwnerId === currentUserId);
  const isLockedByCurrentSession = Boolean(
    isLockedByCurrentUser &&
    (!handlingLockSessionId || handlingLockSessionId === currentClientSessionId)
  );
  const isLockedByAnother = Boolean(handlingOwnerId && !isLockedByCurrentSession);
  const isUnownedInProgress = Boolean(selectedGrievance?.status === "in_progress" && !handlingOwnerId);
  const canBeClaimed = Boolean(
    selectedGrievance &&
    (
      selectedGrievance.status === "assigned_to_department" ||
      isUnownedInProgress
    )
  );
  const showClaimAction = Boolean(selectedGrievance && canBeClaimed && !handlingOwnerId);
  const canOpenRca = Boolean(selectedGrievance && (selectedGrievance.status === "resolved" || isLockedByCurrentSession));
  const canShowResolutionStage = Boolean(selectedGrievance && ["in_progress", "resolved"].includes(selectedGrievance.status));
  const canTriggerResolveStage = Boolean(selectedGrievance && selectedGrievance.status === "in_progress" && isLockedByCurrentSession);
  const showResolvedView = Boolean(
    selectedGrievance?.status === "resolved" &&
    selectedGrievance?.rootCauseAnalysis?.rcaStatus === "resolved" &&
    hasCompleteRcaDetails(selectedGrievance)
  );
  const resolveActionMessage = !selectedGrievance
    ? ""
    : selectedGrievance.status === "resolved"
      ? "This grievance is already resolved. You can view the completed RCA report."
      : isUnownedInProgress
        ? "This grievance is already In Progress but has not been claimed by an Office Handler. Claim it to continue handling and resolution."
        : selectedGrievance.status !== "in_progress"
        ? "Mark this grievance as In Progress first before opening the resolution workflow."
        : !isLockedByCurrentSession
          ? "This grievance is not claimed by your current handler session or is being handled elsewhere."
          : "Continue to the RCA resolution form.";
  const actionLockMessage = isLockedByAnother
    ? `Currently handled by: ${handlingOwnerName}`
    : "Mark this grievance as In Progress first to claim it.";
  const actionCardTitle = isLockedByAnother
    ? "Case Currently Unavailable"
    : isUnownedInProgress
      ? "Claim This Case"
      : selectedGrievance?.status === "in_progress" && isLockedByCurrentSession
        ? "Case Handling Active"
        : "Begin Case Handling";
  const actionCardDescription = isLockedByAnother
    ? "This grievance is currently being handled by another Office Handler."
    : isUnownedInProgress
      ? "This grievance is already In Progress but has no current handler. Claim it to continue handling and resolution."
      : selectedGrievance?.status === "in_progress" && isLockedByCurrentSession
        ? "This grievance is currently being handled by you."
        : "Mark this grievance as In Progress to claim it for handling and unlock RCA and resolution actions.";
  const complainantName = selectedGrievance?.isAnonymous
    ? "Anonymous"
    : selectedGrievance?.complainantName || selectedGrievance?.complainantId?.name || "--";
  const caseTitle = selectedGrievance?.subject || "--";
  const personInvolved = formatTextLabel(selectedGrievance?.personInvolved, "Not specified");
  const satisfactionRating = Number(selectedGrievance?.resolutionSatisfactionRating || 0);
  const satisfactionLabel = SATISFACTION_LABELS[satisfactionRating] || "";
  const archiveReason = String(selectedGrievance?.archiveReason || "").trim();
  const archiveDate = selectedGrievance?.archivedAt ? fmtDate(selectedGrievance.archivedAt) : "--";

  useEffect(() => {
    resolutionNotesDirtyRef.current = resolutionNotesDirty;
  }, [resolutionNotesDirty]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const mergeUpdatedGrievance = (updatedGrievance) => {
    if (!updatedGrievance?._id) {
      reloadAll().catch(() => {});
      return;
    }

    setGrievances((current) =>
      current.map((item) =>
        item._id === updatedGrievance._id
          ? {
              ...item,
              ...updatedGrievance,
              complainantId: updatedGrievance.complainantId || item.complainantId,
              assignedTo: updatedGrievance.assignedTo || item.assignedTo,
              handlingLockedBy:
                updatedGrievance.handlingLockedBy ||
                (updatedGrievance.status === "in_progress"
                  ? {
                      _id: currentUser?._id,
                      name: currentUser?.name,
                      email: currentUser?.email,
                      office: currentUser?.office,
                      role: currentUser?.role,
                    }
                  : item.handlingLockedBy),
              handlingLockSessionId:
                updatedGrievance.handlingLockSessionId ||
                (updatedGrievance.status === "in_progress"
                  ? currentClientSessionId
                  : item.handlingLockSessionId),
              rootCauseAnalysis: updatedGrievance.rootCauseAnalysis || item.rootCauseAnalysis,
            }
          : item
      )
    );

    setSelectedId(updatedGrievance._id);
    setResolutionNotes(updatedGrievance.resolutionNotes || "");
    setResolutionNotesDirty(false);
  };

  const resetViewState = (nextMode) => {
    const nextFilters = {
      search: "",
      status: "",
      archiveType: "",
      page: 1,
      limit: preferences.queuePageSize || 10,
    };

    setViewMode(nextMode);
    setFilters(nextFilters);
    setSelectedId("");
    selectedIdRef.current = "";
    setResolutionNotes("");
    setResolutionNotesDirty(false);
    setShowInlineRca(false);
    return nextFilters;
  };

  const setNotice = (message, type = "success") => {
    if (type === "success") {
      setSuccess(message);
      setError("");
    } else {
      setError(message);
      setSuccess("");
    }

    setTimeout(() => {
      setSuccess("");
      setError("");
    }, 3000);
  };

  const loadStats = async (nextViewMode = viewMode) => {
    const query = new URLSearchParams({
      archived: nextViewMode === "archived" ? "true" : "false",
    });

    const response = await axios.get(`${API_BASE}/grievances/stats?${query.toString()}`, { headers });
    if (response.data?.success) {
      setStats(response.data.data);
    }
  };

  const getPendingDashboardSelection = () => {
    if (typeof window === "undefined") {
      return "";
    }

    return String(localStorage.getItem(OFFICE_SELECTED_GRIEVANCE_KEY) || "");
  };

  const clearPendingDashboardSelection = () => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(OFFICE_SELECTED_GRIEVANCE_KEY);
  };

  const loadGrievanceById = async (grievanceId) => {
    if (!grievanceId) {
      return null;
    }

    const response = await axios.get(`${API_BASE}/grievances/${grievanceId}`, { headers });
    return response.data?.success ? response.data.data : null;
  };

  const loadGrievances = async (nextFilters = filters, nextViewMode = viewMode) => {
    const requestId = ++grievanceRequestIdRef.current;
    const query = new URLSearchParams({
      page: String(nextFilters.page || 1),
      limit: String(nextFilters.limit || 10),
      search: nextFilters.search || "",
      archived: nextViewMode === "archived" ? "true" : "false",
    });

    if (nextViewMode === "archived") {
      if (nextFilters.archiveType) {
        query.set("archiveType", nextFilters.archiveType);
      }
    } else if (nextFilters.status) {
      query.set("status", nextFilters.status);
    }

    const response = await axios.get(`${API_BASE}/grievances/assigned?${query.toString()}`, { headers });
    if (response.data?.success) {
      if (requestId !== grievanceRequestIdRef.current) {
        return;
      }

      const items = response.data.data || [];
      const currentSelectedId = selectedIdRef.current;
      const pendingDashboardSelection = getPendingDashboardSelection();
      setGrievances(items);
      setPagination(
        response.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      );

      if (pendingDashboardSelection) {
        const matchedItem = items.find((item) => item._id === pendingDashboardSelection);

        if (matchedItem) {
          setSelectedId(matchedItem._id);
          selectedIdRef.current = matchedItem._id;
          setResolutionNotes(matchedItem.resolutionNotes || "");
          setResolutionNotesDirty(false);
          clearPendingDashboardSelection();
          return;
        }

        try {
          const focusedGrievance = await loadGrievanceById(pendingDashboardSelection);
          if (requestId !== grievanceRequestIdRef.current) {
            return;
          }

          if (focusedGrievance) {
            setGrievances((current) => [
              focusedGrievance,
              ...current.filter((item) => item._id !== focusedGrievance._id).slice(0, Math.max(0, current.length - 1)),
            ]);
            setSelectedId(focusedGrievance._id);
            selectedIdRef.current = focusedGrievance._id;
            setResolutionNotes(focusedGrievance.resolutionNotes || "");
            setResolutionNotesDirty(false);
            clearPendingDashboardSelection();
            return;
          }
        } catch (focusedError) {
          console.error("Failed to load selected grievance from dashboard:", focusedError);
        }

        clearPendingDashboardSelection();
      }

      if (!currentSelectedId && items[0]) {
        setSelectedId(items[0]._id);
        selectedIdRef.current = items[0]._id;
        setResolutionNotes(items[0].resolutionNotes || "");
        setResolutionNotesDirty(false);
      } else if (currentSelectedId) {
        const nextSelected = items.find((item) => item._id === currentSelectedId);
        if (nextSelected) {
          if (!resolutionNotesDirtyRef.current) {
            setResolutionNotes(nextSelected.resolutionNotes || "");
          }
        } else if (items[0]) {
          setSelectedId(items[0]._id);
          selectedIdRef.current = items[0]._id;
          setResolutionNotes(items[0].resolutionNotes || "");
          setResolutionNotesDirty(false);
        } else {
          setSelectedId("");
          selectedIdRef.current = "";
          setResolutionNotes("");
          setResolutionNotesDirty(false);
        }
      }
    }
  };

  const reloadAll = async (nextFilters = filters, nextViewMode = viewMode) => {
    try {
      setLoading(true);
      await Promise.all([loadStats(nextViewMode), loadGrievances(nextFilters, nextViewMode)]);
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to load grievance data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setError("Missing authentication token. Please sign in again.");
      setLoading(false);
      return;
    }
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!latestUpdate?._id) {
      return;
    }

    Promise.all([loadStats(viewMode), loadGrievances(filters, viewMode)]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestUpdate?._id, latestUpdate?.updatedAt, latestUpdate?.aiAnalysisStatus, viewMode]);

  useEffect(() => {
    if (!selectedGrievance) {
      previousSelectedIdRef.current = "";
      setResolutionNotes("");
      setResolutionNotesDirty(false);
      return;
    }

    const selectedChanged = previousSelectedIdRef.current !== selectedGrievance._id;
    previousSelectedIdRef.current = selectedGrievance._id;

    if (selectedChanged) {
      setCaseReviewStep(1);
    }

    if (selectedChanged || !resolutionNotesDirtyRef.current) {
      setResolutionNotes(selectedGrievance.resolutionNotes || "");
      setResolutionNotesDirty(false);
    }
  }, [selectedGrievance]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const refreshClaims = () => {
      loadGrievances(filters, viewMode).catch(() => {});
      loadStats(viewMode).catch(() => {});
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshClaims();
      }
    }, 5000);

    const handleFocus = () => refreshClaims();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshClaims();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token, filters.limit, filters.page, filters.search, filters.status, filters.archiveType, viewMode]);

  useEffect(() => {
    if (!selectedGrievance) {
      setShowInlineRca(false);
      return;
    }
    setShowInlineRca(false);
  }, [selectedGrievance?._id]);

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value, page: 1 };
    setFilters(next);
    loadGrievances(next, viewMode).catch((err) => {
      setNotice(err.response?.data?.message || "Failed to filter grievance data", "error");
    });
  };

  const handlePageChange = (page) => {
    const next = { ...filters, page };
    setFilters(next);
    loadGrievances(next, viewMode).catch((err) => {
      setNotice(err.response?.data?.message || "Failed to load page", "error");
    });
  };

  const handleViewModeChange = (nextMode) => {
    if (nextMode === viewMode) {
      return;
    }

    const nextFilters = resetViewState(nextMode);
    reloadAll(nextFilters, nextMode).catch((err) => {
      setNotice(err.response?.data?.message || "Failed to load grievance data", "error");
    });
  };

  const handleStatusUpdate = async (status) => {
    if (!selectedGrievance) return;

    try {
      setSaving(true);
      const response = await axios.put(
        `${API_BASE}/grievances/${selectedGrievance._id}/status`,
        { status, resolutionNotes },
        {
          headers: {
            ...headers,
            "X-Client-Session-Id": currentClientSessionId,
          },
        }
      );

      if (response.data?.success) {
        const updatedGrievance = response.data?.data;
        if (updatedGrievance) {
          mergeUpdatedGrievance(updatedGrievance);
          setResolutionNotes(updatedGrievance.resolutionNotes || "");
        }
        setNotice("Grievance updated");
        await Promise.all([loadStats(viewMode), loadGrievances(filters, viewMode)]);
      }
    } catch (err) {
      if (err.response?.data?.data?._id) {
        mergeUpdatedGrievance(err.response.data.data);
      }
      setNotice(err.response?.data?.message || "Failed to update grievance", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-left">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1 text-left">
          <h2 className="text-3xl font-bold text-gray-900">
            {isArchivedView ? "Archived / History" : "Assigned Grievances"}
          </h2>
          <p className="text-gray-600">
            {isArchivedView
              ? "Read-only history for cases that were archived by month-end reset or manual archive actions"
              : "Review and update cases assigned to your account"}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => handleViewModeChange("active")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              !isArchivedView ? "bg-white text-sky-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Active Queue
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("archived")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isArchivedView ? "bg-white text-sky-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Archived / History
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className="mb-6">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {(isArchivedView
            ? [
                ["Archived", stats.total],
                ["Monthly Reset", stats.monthlyReset],
                ["Rejected", stats.rejected],
                ["Deleted", stats.deleted],
              ]
            : [
                ["Total", stats.total],
                ["Pending", stats.pending],
                ["In Progress", stats.inProgress],
                ["Resolved", stats.resolved],
                ["Escalated", stats.escalated],
              ]
          ).map(([label, value]) => (
            <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,2.15fr)]">
        <div className="min-w-0 border border-gray-200 rounded-xl">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <input
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder="Search reference or subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {isArchivedView ? (
              <select
                value={filters.archiveType}
                onChange={(e) => handleFilterChange("archiveType", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All archive types</option>
                {ARCHIVE_TYPE_OPTIONS.filter(Boolean).map((archiveType) => (
                  <option key={archiveType} value={archiveType}>
                    {formatArchiveTypeLabel(archiveType)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Status</option>
                {ACTIVE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{fmtStatus(status, "office")}</option>
                ))}
              </select>
            )}
          </div>

          <div className="max-h-[650px] overflow-y-auto divide-y divide-gray-200">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading grievances...</div>
            ) : grievances.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No assigned grievances found.</div>
            ) : (
              grievances.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedId(item._id)}
                  className={`w-full border border-l-4 p-4 text-left transition-colors ${
                    getQueueItemTone(item, selectedId === item._id)
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{item.referenceNumber}</p>
                      <p className="text-sm text-gray-700">{item.subject}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusBadge(item.status)}`}>
                      {fmtStatus(item.status, "office")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityBadge(getDisplayPriority(item).toLowerCase())}`}>
                      {getDisplayPriority(item)}
                    </span>
                    {isArchivedView && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {formatArchiveTypeLabel(item.archiveType)}
                      </span>
                    )}
                    <SlaBadge grievance={item} />
                    <span className="text-xs text-gray-500">{fmtDate(item.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        <div className="min-w-0 border border-gray-200 rounded-xl p-6">
          {!selectedGrievance ? (
            <div className="h-full flex items-center justify-center text-gray-500">Select a grievance to review.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 text-left">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                    {isArchivedView ? "History Review" : "Case Review"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-gray-900">{selectedGrievance.subject}</h3>
                  <p className="text-sm text-gray-500 mt-1">Tracking ID: {selectedGrievance.referenceNumber || selectedGrievance.trackingId}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${priorityBadge(getDisplayPriority(selectedGrievance).toLowerCase())}`}>
                    {getDisplayPriority(selectedGrievance)}
                  </span>
                  <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${statusBadge(selectedGrievance.status)}`}>
                    {fmtStatus(selectedGrievance.status, "office")}
                  </span>
                  {isArchivedView && (
                    <span className="inline-flex px-3 py-1.5 text-sm font-semibold rounded-full bg-slate-100 text-slate-700">
                      {formatArchiveTypeLabel(selectedGrievance.archiveType)}
                    </span>
                  )}
                  <SlaBadge grievance={selectedGrievance} className="px-3 py-1.5 text-sm" />
                </div>
              </div>

              <CaseReviewStepIndicator currentStep={caseReviewStep} onStepChange={setCaseReviewStep} />

              {caseReviewStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-4">
                    <div className="min-w-0 xl:col-span-3">
                      <GrievanceStatusTracker
                        key={`${selectedGrievance._id}-${selectedGrievance.status}-${selectedGrievance.updatedAt || ""}-${selectedGrievance.inProgressAt || ""}-${selectedGrievance.underReviewAt || ""}-${selectedGrievance.departmentAssignedAt || ""}-${selectedGrievance.officeReceivedAt || ""}-${selectedGrievance.resolvedAt || ""}`}
                        grievance={selectedGrievance}
                        headingLabel="Status Tracking"
                        compact
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">Handling Information</p>
                      {!isArchivedView && selectedGrievance.status !== "resolved" ? (
                        <div
                          className={`mt-3 rounded-xl border px-3 py-2.5 text-sm ${
                            isLockedByAnother
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : isLockedByCurrentSession
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-blue-200 bg-blue-50 text-blue-900"
                          }`}
                        >
                          <p className="font-semibold">
                            {handlingOwnerId ? `Currently handled by: ${handlingOwnerName}` : "Waiting for first handler claim"}
                          </p>
                          <p className="mt-1 leading-5">
                            {isLockedByAnother
                              ? "This grievance is view only for your account. Mark In Progress, RCA, and resolution actions are disabled."
                              : isLockedByCurrentSession
                                ? "You claimed this grievance first. RCA and resolution actions are enabled for your account."
                                : "The first office handler who clicks Mark In Progress will lock this grievance for action."}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {isArchivedView ? "Archived cases are available for review only." : "This grievance is already resolved."}
                        </p>
                      )}
                    </div>
                  </div>

                  <ConversationTranscript
                    grievance={selectedGrievance}
                    defaultExpanded
                    forceExpanded
                    hideToggle
                  />
                </div>
              )}

              {caseReviewStep === 2 && (
                <div className="space-y-5">
                  {isArchivedView && (
                    <div className={DETAIL_CARD_CLASS}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">Archive Details</p>
                      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                        <DetailRow label="Archive Type" value={formatArchiveTypeLabel(selectedGrievance.archiveType)} />
                        <DetailRow label="Archived At" value={archiveDate} />
                        <DetailRow label="Archive Reason" value={archiveReason || "No reason provided"} />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-sm">
                <DetailCard
                  label="Complainant"
                  title={complainantName}
                >
                  <div className="space-y-3">
                    <DetailRow
                      label="Submission"
                      value={selectedGrievance.isAnonymous ? "Anonymous grievance" : "Filed with identity"}
                    />
                    <DetailRow label="Reference" value={selectedGrievance.referenceNumber || "--"} />
                  </div>
                </DetailCard>

                <DetailCard
                  label="Case Details"
                  title={caseTitle}
                  // subtitle={`Incident Date: ${fmtIncidentDate(selectedGrievance.incidentDate)}`}
                >
                  <div className="space-y-3">
                    <DetailRow
                      label="Priority"
                      value={<PriorityDetailBadge value={getDisplayPriority(selectedGrievance)} />}
                    />
                    <DetailRow label="Complaint Type" value={formatTextLabel(getDisplayCategory(selectedGrievance))} />
                    <DetailRow label="Person Involved" value={personInvolved} />
                  </div>
                </DetailCard>
                  </div>

                  <div className={DETAIL_CARD_CLASS}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Original Description</p>
                    <div className="mt-4 whitespace-pre-line break-words text-left text-base leading-7 text-slate-800">
                      {getOriginalDescription(selectedGrievance) || "--"}
                    </div>
                  </div>

              {hasDistinctProcessedDescription(selectedGrievance) && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Processed Description</p>
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      AI Processed
                    </span>
                  </div>
                  <div className="mt-4 whitespace-pre-line break-words text-left text-base leading-7 text-slate-800">
                    {getDisplayProcessedDescription(selectedGrievance) || "--"}
                  </div>
                </div>
              )}

                  <div className={DETAIL_CARD_CLASS}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Additional Information</p>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <InfoField label="Incident Date" value={fmtIncidentDate(selectedGrievance.incidentDate)} />
                      <InfoField label="Office" value={formatTextLabel(selectedGrievance.office, "N/A")} />
                      <InfoField label="Department" value={formatTextLabel(selectedGrievance.department, "N/A")} />
                    </div>
                  </div>
                </div>
              )}

              {caseReviewStep === 3 && (
                <div className="space-y-5">
                  <AiAnalysisPanel grievance={selectedGrievance} />
                  <div className={DETAIL_CARD_CLASS}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">Attachments</p>
                    {selectedGrievance.attachments?.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {selectedGrievance.attachments.map((attachment, index) => (
                          <AttachmentPreviewCard
                            key={`${attachment.url || attachment.fileName || index}-${index}`}
                            attachment={attachment}
                            index={index}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        No attachments were submitted with this grievance.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {caseReviewStep === 4 && (
                <div className="space-y-5">
                  {!isArchivedView && selectedGrievance.status === "resolved" && (
                    <div className={DETAIL_CARD_CLASS}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">Complainant Satisfaction</p>
                  {satisfactionRating ? (
                    <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Rating</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {satisfactionRating} {"⭐".repeat(satisfactionRating)}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{satisfactionLabel}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted</p>
                          <p className="mt-2 text-sm text-slate-700">
                            {selectedGrievance.resolutionSatisfactionSubmittedAt
                              ? fmtDate(selectedGrievance.resolutionSatisfactionSubmittedAt)
                              : "Recorded with no timestamp"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                      No satisfaction rating submitted yet.
                    </div>
                  )}
                    </div>
                  )}

                  <div className={DETAIL_CARD_CLASS}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2450ff]">Actions</p>
                    {!isArchivedView ? (
                      <div className="mt-4 space-y-5">
                        <div className="text-left">
                          <h4 className="text-lg font-semibold text-slate-950">{actionCardTitle}</h4>
                          <p className="mt-1.5 text-sm leading-6 text-slate-600">{actionCardDescription}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-600">Current Status</p>
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusBadge(selectedGrievance.status)}`}>
                            {fmtStatus(selectedGrievance.status, "office")}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {showClaimAction && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate("in_progress")}
                              disabled={saving || isLockedByAnother}
                              title={isLockedByAnother ? actionLockMessage : "Claim this grievance for handling"}
                              className="w-full rounded-xl bg-blue-600 px-10 py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isUnownedInProgress ? "Claim for Handling" : "Mark In Progress"}
                            </button>
                          )}
                          {canShowResolutionStage && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setShowInlineRca(true)}
                                disabled={!canTriggerResolveStage && !showResolvedView}
                                title={resolveActionMessage}
                                className="w-full rounded-xl bg-emerald-600 px-10 py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {showResolvedView ? "View RCA" : "Resolve"}
                              </button>
                              {(!canTriggerResolveStage || showResolvedView) && resolveActionMessage && (
                                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                                  {resolveActionMessage}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        Archived cases are available for review only.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <CaseReviewPager currentStep={caseReviewStep} onStepChange={setCaseReviewStep} />
            </div>
          )}
        </div>
      </div>

      <RCAFormModal
        isOpen={showInlineRca && canOpenRca}
        grievance={selectedGrievance}
        onClose={() => setShowInlineRca(false)}
        onRCASaved={(updatedGrievance) => {
          mergeUpdatedGrievance(updatedGrievance);
          setShowInlineRca(true);
          loadStats(viewMode).catch(() => {});
        }}
        onResolved={(updatedGrievance) => {
          mergeUpdatedGrievance(updatedGrievance);
          setResolutionNotes(updatedGrievance?.resolutionNotes || "");
          setShowInlineRca(true);
          loadStats(viewMode).catch(() => {});
        }}
        onLockConflict={(updatedGrievance) => {
          if (updatedGrievance?._id) {
            mergeUpdatedGrievance(updatedGrievance);
          } else {
            reloadAll().catch(() => {});
          }
          setShowInlineRca(false);
        }}
      />
    </div>
  );
};

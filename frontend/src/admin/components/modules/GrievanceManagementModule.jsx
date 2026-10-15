import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import authService from '../../../services/authService';
import adminService from '../../../services/adminService';
import API_BASE_URL from '../../../config/api';
import { useRealTimeGrievances } from '../../../hooks/useRealTime';
import GrievanceDetailsModal from './GrievanceDetailsModal';
import GrievanceEditModal from './GrievanceEditModal';
import GrievanceDeleteModal from './GrievanceDeleteModal';
import { formatGrievanceStatus } from '../../../utils/grievanceStatus';
import { hasAdminPermission } from '../../../utils/adminPermissions';
import { normalizeAiCategoryLabel, getModelAnalysisForDisplay, isPredefinedAiAnalysis } from '../../../utils/aiAnalysis';
import { getGrievanceSlaStatus } from '../../../utils/grievanceSla';

const API_BASE = `${API_BASE_URL}/admin`;
const ADMIN_SELECTED_GRIEVANCE_KEY = 'admin_dashboard_selected_grievance_id';

const allStatusOptions = ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'escalated', 'resolved', 'rejected'];
const openStatusOptions = ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'escalated'];
const priorityOptions = ['low', 'medium', 'high', 'critical'];

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ArchiveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v10m0 0l-4-4m4 4l4-4M4 14h4l2 3h4l2-3h4v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" />
  </svg>
);

const RouteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h6m0 0v6m0-6L10 16l-5-5" />
  </svg>
);

const MemoIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
  </svg>
);

const statusBadge = (status) => {
  const map = {
    pending: 'bg-amber-100 text-amber-800',
    under_review: 'bg-blue-100 text-blue-800',
    assigned_to_department: 'bg-cyan-100 text-cyan-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
    escalated: 'bg-purple-100 text-purple-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

const normalizePriorityLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'urgent') {
    return 'critical';
  }
  return normalized;
};

const urgencyTone = (value, closed = false) => {
  const normalized = normalizePriorityLabel(value);

  if (closed) {
    return {
      row: 'hover:bg-gray-50',
      badge: 'bg-gray-100 text-gray-600 border-gray-200',
    };
  }

  const map = {
    critical: {
      row: 'bg-red-50/70 hover:bg-red-100/70',
      badge: 'bg-red-100 text-red-700 border-red-200',
    },
    high: {
      row: 'bg-orange-50/70 hover:bg-orange-100/70',
      badge: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    medium: {
      row: 'bg-amber-50/70 hover:bg-amber-100/70',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    low: {
      row: 'bg-emerald-50/70 hover:bg-emerald-100/70',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
  };

  return map[normalized] || {
    row: 'hover:bg-gray-50',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
  };
};

const fmtStatus = (value) => formatGrievanceStatus(value);
const fmtDate = (v) => (v ? new Date(v).toLocaleString() : '--');
const StatusBadge = ({ grievance }) => {
  const statusLabel = fmtStatus(grievance.status);
  const statusClassName = statusBadge(grievance.status);

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClassName}`}>
      {statusLabel}
    </span>
  );
};

const SlaStatusBadge = ({ grievance, view }) => {
  if (view === 'memo_created') {
    return (
      <span className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold bg-sky-100 text-sky-800">
        Memo Created
      </span>
    );
  }

  const sla = getGrievanceSlaStatus(grievance);
  const showSlaBadge =
    !grievance.archived &&
    !['resolved', 'rejected'].includes(grievance.status) &&
    sla.state !== 'unknown';

  if (!showSlaBadge) {
    return <span className="text-xs text-gray-400">--</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {/* <span
        title={sla.label}
        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${sla.className}`}
      >
        {sla.badgeLabel || sla.label}
      </span> */}
      {sla.state === 'overdue' ? (
        <span className="text-[11px] font-medium text-rose-700 normal-case tracking-normal">
          {sla.label}
        </span>
      ) : (
        <span className="text-[11px] font-medium text-slate-700 normal-case tracking-normal">
          {sla.label}
        </span>
      )}
    </div>
  );
};

const isActiveOverdueGrievance = (grievance) => {
  const sla = getGrievanceSlaStatus(grievance);
  return (
    !grievance.archived &&
    grievance.overdueMemoCreated !== true &&
    openStatusOptions.includes(grievance.status) &&
    sla.state === 'overdue'
  );
};

const normalizeViewCounts = (counts = {}) => ({
  all: Number(counts.all || counts.total || 0),
  active: Number(counts.active || 0),
  overdue: Number(counts.overdue || counts.activeOverdue || 0),
  memo_created: Number(counts.memo_created || counts.memoCreated || 0),
  resolved: Number(counts.resolved || 0),
  rejected: Number(counts.rejected || 0),
});

const getAllowedStatusOptions = (view) => {
  if (view === 'active' || view === 'overdue') {
    return openStatusOptions;
  }

  if (view === 'resolved') {
    return ['resolved'];
  }

  if (view === 'rejected') {
    return ['rejected'];
  }

  return allStatusOptions;
};

const getStatusPlaceholder = (view) => {
  if (view === 'active' || view === 'overdue') {
    return 'All Active Statuses';
  }

  return 'All Status';
};

const normalizeFiltersForView = (nextFilters, view) => {
  const allowedStatuses = getAllowedStatusOptions(view);

  if (!nextFilters.status || allowedStatuses.includes(nextFilters.status)) {
    return nextFilters;
  }

  return {
    ...nextFilters,
    status: '',
  };
};

const getGrievanceViewCopy = (view) => {
  const copy = {
    all: {
      empty: 'No grievances found.',
      label: 'All Grievances',
      helper: 'All Grievances shows every non-archived grievance across status, SLA, and memo states.',
    },
    active: {
      empty: 'No active grievances within SLA found.',
      label: 'Active Grievances',
      helper: 'Active Grievances shows open cases that are still within the 72-hour SLA.',
    },
    overdue: {
      empty: 'No active overdue grievances found.',
      label: 'Active Overdue',
      helper: 'Active Overdue shows open grievances that have exceeded the 72-hour SLA and have not yet been marked as memo created.',
    },
    memo_created: {
      empty: 'No memo-created grievances found.',
      label: 'Memo Created',
      helper: 'Memo Created shows grievances whose overdue memo has already been acknowledged by an authorized administrator.',
    },
    resolved: {
      empty: 'No resolved grievances found.',
      label: 'Resolved',
      helper: 'Resolved shows non-archived grievances completed through the resolution workflow.',
    },
    rejected: {
      empty: 'No rejected grievances found.',
      label: 'Rejected',
      helper: 'Rejected shows non-archived grievances that were rejected during review.',
    },
  };

  return copy[view] || copy.all;
};

const formatMonthLabel = (value) => {
  if (!value) {
    return 'all months';
  }

  const [year, month] = String(value).split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const normalizeOfficeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const isBlankDepartmentValue = (value) => {
  const normalized = normalizeOfficeKey(value);
  return !normalized || ['n/a', 'na', 'none', 'not applicable', 'not specified', '--'].includes(normalized);
};

const officeTokenStopwords = new Set([
  'OF',
  'AND',
  'THE',
  'COLLEGE',
  'DEPARTMENT',
  'SCHOOL',
  'LABORATORY',
  'TECHNOLOGY',
  'TECHNOLOGIES',
  'PUBLIC',
  'ADMINISTRATION',
  'GOVERNANCE',
  'ARTS',
  'SCIENCES',
  'BUSINESS',
  'EDUCATION',
  'NURSING',
  'LAW',
]);

const getOfficeCollegeAcronym = (value) => {
  if (!value) {
    return '';
  }

  const text = String(value).trim().replace(/[_-]+/g, ' ');
  const parenthesized = text.match(/\(([A-Za-z]{2,6})\)/);
  if (parenthesized?.[1]) {
    return parenthesized[1].toUpperCase();
  }

  const tokens = text
    .toUpperCase()
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return tokens.find(
    (token) =>
      /^[A-Z]{2,6}$/.test(token) &&
      !officeTokenStopwords.has(token)
  ) || '';
};

const formatOfficeLabel = (value, options = {}) => {
  if (!value) {
    return '--';
  }

  const text = String(value).trim();
  if (options.acronymOnly) {
    return getOfficeCollegeAcronym(text) || text;
  }

  if (/^[a-z0-9_-]+$/i.test(text) && /[_-]/.test(text)) {
    return text.replace(/[_-]+/g, ' ').toUpperCase();
  }

  return text;
};

const fmtConfidence = (value) => {
  if (value == null || value === '') {
    return '--';
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return '--';
  }

  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(1)}%`;
};

const formatConfidenceInput = (value) => {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  const normalized = numeric <= 1 ? numeric * 100 : numeric;
  return Number.isNaN(normalized) ? '' : Number(normalized.toFixed(1));
};

const aiLabel = (analysis, key, fallback, status) => {
  if (analysis?.[key]?.label) {
    if (key === 'urgency') {
      return normalizePriorityLabel(analysis[key].label);
    }

    if (key === 'category') {
      return normalizeAiCategoryLabel(analysis[key].label);
    }

    return analysis[key].label;
  }

  if (status === 'pending') {
    return 'Processing...';
  }

  if (status === 'failed') {
    return 'Unavailable';
  }

  if (key === 'urgency') {
    return normalizePriorityLabel(fallback) || '--';
  }

  if (key === 'category') {
    return normalizeAiCategoryLabel(fallback || '--');
  }

  return fallback || '--';
};

const aiMetaText = (status, confidence) => {
  if (status === 'pending') {
    return 'Analyzing complaint';
  }

  if (status === 'failed') {
    return 'AI unavailable';
  }

  return `AI Confidence: ${fmtConfidence(confidence)}`;
};

const fmtEditedAt = (value) => (value ? new Date(value).toLocaleString() : '');

const getEffectiveAiAnalysis = (grievance) => {
  const modelAnalysis = getModelAnalysisForDisplay(grievance?.aiAnalysis);
  if (!grievance?.aiAnalysisOverrideAt || !grievance?.aiAnalysisOverride) {
    return modelAnalysis || null;
  }

  return {
    ...modelAnalysis,
    ...grievance.aiAnalysisOverride,
    category: {
      ...modelAnalysis?.category,
      ...grievance.aiAnalysisOverride?.category,
    },
    urgency: {
      ...modelAnalysis?.urgency,
      ...grievance.aiAnalysisOverride?.urgency,
    },
    sentiment: {
      ...modelAnalysis?.sentiment,
      ...grievance.aiAnalysisOverride?.sentiment,
    },
  };
};

const getAiStatusForDisplay = (grievance) => (
  grievance?.aiAnalysisOverrideAt ? 'completed' : isPredefinedAiAnalysis(grievance?.aiAnalysis) ? 'failed' : grievance?.aiAnalysisStatus
);

const GrievanceManagementModule = () => {
  const { latestUpdate } = useRealTimeGrievances();
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState(null);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [grievanceView, setGrievanceView] = useState('all');
  const [viewCounts, setViewCounts] = useState({
    all: 0,
    active: 0,
    overdue: 0,
    memo_created: 0,
    resolved: 0,
    rejected: 0,
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [routeCollege, setRouteCollege] = useState('');
  const [routeLevel, setRouteLevel] = useState('department');
  const [routeDepartment, setRouteDepartment] = useState('');
  const [editForm, setEditForm] = useState({
    status: 'pending',
    office: '',
    aiOverrideEnabled: false,
    aiOverrideSummary: '',
    aiOverrideCategoryLabel: '',
    aiOverrideCategoryConfidence: '',
    aiOverrideUrgencyLabel: '',
    aiOverrideUrgencyConfidence: '',
    aiOverrideSentimentLabel: '',
    aiOverrideSentimentConfidence: '',
  });
  const [deleteReason, setDeleteReason] = useState('');

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    office: '',
    month: '',
    page: 1,
    limit: 10,
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const token = authService.getToken();
  const currentUser = useMemo(() => authService.getUser(), []);
  const isSuperadmin = currentUser?.role === 'superadmin';
  const canEditGrievances = isSuperadmin || hasAdminPermission(currentUser, 'grievances.edit');
  const canArchiveGrievances = isSuperadmin || hasAdminPermission(currentUser, 'grievances.delete');
  const canExportGrievances = isSuperadmin || hasAdminPermission(currentUser, 'grievances.export');

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const collegeOptions = useMemo(() => {
    const map = new Map();
    offices.forEach((office) => {
      const college = String(office?.college || '').trim();
      if (college && !map.has(normalizeOfficeKey(college))) {
        map.set(normalizeOfficeKey(college), college);
      }
    });
    return [...map.values()].sort((left, right) => left.localeCompare(right));
  }, [offices]);

  const routeDepartmentOptions = useMemo(() =>
    offices
      .filter((office) =>
        normalizeOfficeKey(office?.college) === normalizeOfficeKey(routeCollege) &&
        String(office?.department || '').trim()
      )
      .sort((left, right) => String(left.department || '').localeCompare(String(right.department || ''))),
    [offices, routeCollege]
  );

  const findRouteCategory = (college, level, department = '') => {
    if (!college || (level === 'department' && !String(department).trim())) {
      return null;
    }

    return offices.find((office) => {
      const sameCollege = normalizeOfficeKey(office?.college) === normalizeOfficeKey(college);
      if (!sameCollege) {
        return false;
      }

      if (level === 'college') {
        return !String(office?.department || '').trim();
      }

      return normalizeOfficeKey(office?.department) === normalizeOfficeKey(department);
    }) || null;
  };

  const findOfficeByValue = (value) => {
    const normalized = normalizeOfficeKey(value);
    if (!normalized) {
      return null;
    }

    return offices.find((office) =>
      [office?.name, office?.id, office?.slug, office?.college]
        .filter(Boolean)
        .some((candidate) => normalizeOfficeKey(candidate) === normalized)
    ) || null;
  };

  const findCollegeMatch = (value) => {
    const normalized = normalizeOfficeKey(value);
    const acronym = getOfficeCollegeAcronym(value);
    if (!normalized && !acronym) {
      return null;
    }

    return offices.find((office) => {
      const college = office?.college || office?.name || '';
      return (
        normalizeOfficeKey(college) === normalized ||
        normalizeOfficeKey(office?.name) === normalized ||
        (acronym && getOfficeCollegeAcronym(college) === acronym) ||
        (acronym && getOfficeCollegeAcronym(office?.name) === acronym)
      );
    }) || null;
  };

  const resolveConcernedOfficeDetails = (grievance) => {
    const rawOffice = grievance?.office || '';
    const rawDepartment = isBlankDepartmentValue(grievance?.department) ? '' : String(grievance?.department || '').trim();
    const exactOffice = findOfficeByValue(rawOffice);
    const collegeMatch = exactOffice || findCollegeMatch(rawOffice);
    const departmentMatch = rawDepartment
      ? offices.find((office) =>
          normalizeOfficeKey(office?.college) === normalizeOfficeKey(collegeMatch?.college || rawOffice) &&
          normalizeOfficeKey(office?.department) === normalizeOfficeKey(rawDepartment)
        )
      : null;

    return {
      college: departmentMatch?.college || collegeMatch?.college || exactOffice?.college || rawOffice || '',
      department: rawDepartment,
      category: departmentMatch || exactOffice || collegeMatch || null,
    };
  };

  const resolveSuggestedRoute = (grievance) => {
    const concerned = resolveConcernedOfficeDetails(grievance);
    if (!concerned.college) {
      return {
        destination: '',
        college: '',
        level: 'department',
        department: '',
      };
    }

    const departmentRoute = concerned.department
      ? findRouteCategory(concerned.college, 'department', concerned.department)
      : null;
    if (departmentRoute) {
      return {
        destination: departmentRoute.name,
        college: departmentRoute.college,
        level: 'department',
        department: departmentRoute.department,
      };
    }

    if (concerned.department) {
      return {
        destination: '',
        college: concerned.college,
        level: 'department',
        department: concerned.department,
      };
    }

    const collegeRoute = findRouteCategory(concerned.college, 'college');
    if (collegeRoute) {
      return {
        destination: collegeRoute.name,
        college: collegeRoute.college,
        level: 'college',
        department: '',
      };
    }

    return {
      destination: concerned.category?.name || concerned.college,
      college: concerned.college,
      level: concerned.department ? 'department' : 'college',
      department: concerned.department,
    };
  };

  const resolveOfficeDestination = (grievance) => {
    if (!grievance) {
      return '';
    }

    const suggestedRoute = resolveSuggestedRoute(grievance);
    if (suggestedRoute.destination) {
      return suggestedRoute.destination;
    }

    const departmentMatch = offices.find((office) => {
      const sameCollege =
        normalizeOfficeKey(office?.college) === normalizeOfficeKey(grievance.office);
      const sameDepartment =
        normalizeOfficeKey(office?.department) === normalizeOfficeKey(grievance.department);
      return sameCollege && sameDepartment;
    });

    if (departmentMatch?.name) {
      return departmentMatch.name;
    }

    const officeCandidates = [grievance.office, grievance.assignedTo?.office].filter(Boolean);

    for (const candidate of officeCandidates) {
      const exactMatch = offices.find((office) =>
        [office?.name, office?.id, office?.slug].some(
          (value) => normalizeOfficeKey(value) === normalizeOfficeKey(candidate)
        )
      );

      if (exactMatch?.name) {
        return exactMatch.name;
      }
    }

    const fallbackDepartmentMatch = offices.find(
      (office) =>
        normalizeOfficeKey(office?.department) === normalizeOfficeKey(grievance.department)
    );

    if (fallbackDepartmentMatch?.name) {
      return fallbackDepartmentMatch.name;
    }

    return officeCandidates[0] || '';
  };

  const loadStats = async () => {
    const response = await axios.get(`${API_BASE}/grievances/stats`, { headers });
    if (response.data?.success) {
      setStats(response.data.data);
    }
  };

  const loadOffices = async () => {
    const response = await authService.getOffices();
    if (response?.success) {
      setOffices(response.offices || response.data?.offices || []);
    }
  };

  const getPendingDashboardSelection = () => {
    if (typeof window === 'undefined') {
      return '';
    }

    return String(localStorage.getItem(ADMIN_SELECTED_GRIEVANCE_KEY) || '');
  };

  const clearPendingDashboardSelection = () => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(ADMIN_SELECTED_GRIEVANCE_KEY);
  };

  const loadGrievanceById = async (grievanceId) => {
    if (!grievanceId) {
      return null;
    }

    const response = await axios.get(`${API_BASE}/grievances/${grievanceId}`, { headers });
    return response.data?.success ? response.data.data : null;
  };

  const loadGrievances = async (
    nextFilters = filters,
    archived = showArchived,
    view = grievanceView
  ) => {
    const effectiveFilters = archived ? nextFilters : normalizeFiltersForView(nextFilters, view);
    const query = new URLSearchParams({
      page: String(effectiveFilters.page || 1),
      limit: String(effectiveFilters.limit || 10),
      search: effectiveFilters.search || '',
      status: effectiveFilters.status || '',
      priority: effectiveFilters.priority || '',
      office: effectiveFilters.office || '',
      month: effectiveFilters.month || '',
      archived: archived ? 'true' : 'false',
    });
    if (!archived && view) {
      query.set('grievanceView', view);
    }
    const response = await axios.get(`${API_BASE}/grievances?${query.toString()}`, { headers });
    if (response.data?.success) {
      const items = response.data.data || [];
      const pendingDashboardSelection = getPendingDashboardSelection();
      setGrievances(items);
      setPagination(response.data.pagination || pagination);
      if (response.data.viewCounts) {
        setViewCounts(normalizeViewCounts(response.data.viewCounts));
      }

      if (pendingDashboardSelection) {
        const matchedItem = items.find((item) => item._id === pendingDashboardSelection);

        if (matchedItem) {
          setSelectedGrievance(matchedItem);
          setShowDetailsModal(true);
          clearPendingDashboardSelection();
          return;
        }

        try {
          const focusedGrievance = await loadGrievanceById(pendingDashboardSelection);
          if (focusedGrievance) {
            setGrievances((current) => [
              focusedGrievance,
              ...current.filter((item) => item._id !== focusedGrievance._id).slice(0, Math.max(0, current.length - 1)),
            ]);
            setSelectedGrievance(focusedGrievance);
            setShowDetailsModal(true);
          }
        } finally {
          clearPendingDashboardSelection();
        }
      }
    }
  };

  const reloadAll = async (nextFilters = filters) => {
    try {
      setLoading(true);
      await Promise.all([loadStats(), loadGrievances(nextFilters), loadOffices()]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load grievance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setError('Missing authentication token. Please sign in again.');
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

    setSelectedGrievance((current) => {
      if (!current || current._id !== latestUpdate._id) {
        return current;
      }

      return {
        ...current,
        ...latestUpdate,
        complainantId: latestUpdate.complainantId || current.complainantId,
        assignedTo: latestUpdate.assignedTo || current.assignedTo,
        rootCauseAnalysis: latestUpdate.rootCauseAnalysis || current.rootCauseAnalysis,
      };
    });

    Promise.all([loadStats(), loadGrievances(filters, showArchived)]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestUpdate?._id, latestUpdate?.updatedAt, latestUpdate?.aiAnalysisStatus]);

  const setNotice = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccess(msg);
      setError('');
    } else {
      setError(msg);
      setSuccess('');
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  const handleFilterChange = (key, value) => {
    const next = normalizeFiltersForView({ ...filters, [key]: value, page: 1 }, grievanceView);
    setFilters(next);
    setLoading(true);
    loadGrievances(next, showArchived)
      .catch((err) => {
        setNotice(err.response?.data?.message || 'Failed to filter grievances', 'error');
      })
      .finally(() => setLoading(false));
  };

  const handlePageChange = (page) => {
    const next = normalizeFiltersForView({ ...filters, page }, grievanceView);
    setFilters(next);
    setLoading(true);
    loadGrievances(next, showArchived)
      .catch((err) => {
        setNotice(err.response?.data?.message || 'Failed to load page', 'error');
      })
      .finally(() => setLoading(false));
  };

  const handleGrievanceViewChange = (view) => {
    const next = normalizeFiltersForView({ ...filters, page: 1 }, view);
    setGrievanceView(view);
    setFilters(next);
    setShowArchived(false);
    setGrievances([]);
    setPagination((current) => ({
      ...current,
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    }));
    setLoading(true);
    loadGrievances(next, false, view)
      .catch((err) => {
        setNotice(err.response?.data?.message || 'Failed to load grievances', 'error');
      })
      .finally(() => setLoading(false));
  };

  const openViewModal = (grievance) => {
    setSelectedGrievance(grievance);
    setShowDetailsModal(true);
  };

  const openEditModal = (grievance) => {
    const destination = resolveOfficeDestination(grievance);
    const override = grievance.aiAnalysisOverride || {};
    const baseAnalysis = grievance.aiAnalysis || {};
    const hasOverride = !!grievance.aiAnalysisOverrideAt;
    setSelectedGrievance(grievance);
    setEditForm({
      status: grievance.status || 'pending',
      office: destination,
      aiOverrideEnabled: hasOverride,
      aiOverrideSummary: override.summary || baseAnalysis.summary || '',
      aiOverrideCategoryLabel: normalizeAiCategoryLabel(override.category?.label || baseAnalysis.category?.label || '', ''),
      aiOverrideCategoryConfidence: formatConfidenceInput(override.category?.confidence ?? baseAnalysis.category?.confidence),
      aiOverrideUrgencyLabel: override.urgency?.label || baseAnalysis.urgency?.label || '',
      aiOverrideUrgencyConfidence: formatConfidenceInput(override.urgency?.confidence ?? baseAnalysis.urgency?.confidence),
      aiOverrideSentimentLabel: override.sentiment?.label || baseAnalysis.sentiment?.label || '',
      aiOverrideSentimentConfidence: formatConfidenceInput(override.sentiment?.confidence ?? baseAnalysis.sentiment?.confidence),
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (grievance) => {
    setSelectedGrievance(grievance);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const openRouteModal = (grievance) => {
    const suggestedRoute = resolveSuggestedRoute(grievance);
    setSelectedGrievance(grievance);
    setRouteCollege(suggestedRoute.college || '');
    setRouteLevel(suggestedRoute.level || 'department');
    setRouteDepartment(suggestedRoute.department || '');
    setShowRouteModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedGrievance) return;

    try {
      setSaving(true);
      const response = await axios.put(
        `${API_BASE}/grievances/${selectedGrievance._id}`,
        {
          status: editForm.status,
          office: editForm.office,
          aiAnalysisOverrideEnabled: editForm.aiOverrideEnabled,
          aiAnalysisOverride: editForm.aiOverrideEnabled
            ? {
                summary: editForm.aiOverrideSummary,
                category: {
                  label: editForm.aiOverrideCategoryLabel,
                  confidence: editForm.aiOverrideCategoryConfidence,
                },
                urgency: {
                  label: editForm.aiOverrideUrgencyLabel,
                  confidence: editForm.aiOverrideUrgencyConfidence,
                },
                sentiment: {
                  label: editForm.aiOverrideSentimentLabel,
                  confidence: editForm.aiOverrideSentimentConfidence,
                },
              }
            : null,
        },
        { headers }
      );

      if (response.data?.success) {
        const updatedGrievance = response.data?.data;
        if (updatedGrievance?._id) {
          setGrievances((current) =>
            current.map((item) =>
              item._id === updatedGrievance._id
                ? {
                    ...item,
                    ...updatedGrievance,
                    complainantId: updatedGrievance.complainantId || item.complainantId,
                    assignedTo: updatedGrievance.assignedTo || item.assignedTo,
                  }
                : item
            )
          );
        }
        setNotice('Grievance updated successfully');
        setShowEditModal(false);
        setSelectedGrievance(null);
        await Promise.all([loadStats(), loadGrievances(filters, showArchived)]);
      }
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to update grievance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveDelete = async () => {
    if (!selectedGrievance) return;
    if (!deleteReason.trim()) {
      setNotice('Please provide a reason before archiving', 'error');
      return;
    }

    try {
      setSaving(true);
      const response = await axios.delete(`${API_BASE}/grievances/${selectedGrievance._id}`, {
        headers,
        data: { reason: deleteReason.trim() },
      });

      if (response.data?.success) {
        setNotice('Grievance archived successfully');
        setShowDeleteModal(false);
        setSelectedGrievance(null);
        setDeleteReason('');
        await Promise.all([loadStats(), loadGrievances(filters, showArchived)]);
      }
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to archive grievance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdminStatusUpdate = async (status) => {
    if (!selectedGrievance) return;

    try {
      setSaving(true);
      const response = await axios.put(
        `${API_BASE}/grievances/${selectedGrievance._id}/status`,
        {
          status,
          version: selectedGrievance.__v,
        },
        { headers }
      );

      if (response.data?.success) {
        const updatedGrievance = response.data.data;
        setSelectedGrievance(updatedGrievance);
        setGrievances((current) =>
          current.map((item) => (item._id === updatedGrievance._id ? { ...item, ...updatedGrievance } : item))
        );
        setNotice(response.data.message || 'Grievance status updated successfully');
        await Promise.all([loadStats(), loadGrievances(filters, showArchived)]);
      }
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to update grievance status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkOverdueMemoCreated = async (grievance) => {
    console.info('Preparing overdue memo acknowledgement', {
      grievanceId: grievance?._id,
      referenceNumber: grievance?.referenceNumber || grievance?.trackingId,
    });

    if (!grievance?._id) {
      setNotice('Cannot record overdue memo: grievance ID is missing.', 'error');
      return;
    }

    if (!isActiveOverdueGrievance(grievance)) return;

    const result = await Swal.fire({
      icon: 'question',
      title: 'Confirm Memo Creation',
      text: 'Confirm that the required memo for this overdue grievance has already been created. The grievance will be removed from the active overdue list, but the grievance record and its current status will remain unchanged.',
      showCancelButton: true,
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setSaving(true);
      const response = await adminService.markOverdueMemoCreated(grievance._id);

      if (response?.success) {
        const updatedGrievance = response.data;
        setGrievances((current) =>
          grievanceView === 'overdue'
            ? current.filter((item) => item._id !== grievance._id)
            : current.map((item) => (item._id === updatedGrievance._id ? { ...item, ...updatedGrievance } : item))
        );
        setSelectedGrievance((current) =>
          current?._id === updatedGrievance?._id ? { ...current, ...updatedGrievance } : current
        );
        setNotice(response.message || 'Memo recorded successfully. The grievance has been moved to the Memo Created list.');
        await Swal.fire({
          icon: 'success',
          title: 'Memo Recorded',
          text: response.message || 'Memo recorded successfully. The grievance has been moved to the Memo Created list.',
          confirmButtonColor: '#2563eb',
        });
        await Promise.all([loadStats(), loadGrievances(filters, false, grievanceView)]);
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to record overdue memo creation';
      console.error('Failed to record overdue memo creation:', {
        status: err.response?.status || err.status,
        message,
        data: err.response?.data,
      });
      setNotice(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRouteToOffice = async () => {
    const selectedRouteCategory = findRouteCategory(routeCollege, routeLevel, routeDepartment);
    const selectedDestination = selectedRouteCategory?.name || '';

    if (!selectedGrievance || !selectedDestination) {
      setNotice('No office destination is available for this grievance', 'error');
      return;
    }

    try {
      setSaving(true);
      const response = await axios.put(
        `${API_BASE}/grievances/${selectedGrievance._id}/reassign-office`,
        {
          newOffice: selectedDestination,
          reassignReason: `Superadmin routed grievance to ${selectedDestination}.`,
          version: selectedGrievance.__v,
        },
        { headers }
      );

      if (response.data?.success) {
        setNotice(response.data.message || `Grievance routed to ${selectedDestination}`);
        await Swal.fire({
          icon: 'success',
          title: 'Routed Successfully',
          text: response.data.message || `The grievance was routed to ${selectedDestination}.`,
          confirmButtonColor: '#7c3aed',
        });
        setShowRouteModal(false);
        setSelectedGrievance(null);
        setRouteCollege('');
        setRouteLevel('department');
        setRouteDepartment('');
        await Promise.all([loadStats(), loadGrievances(filters, showArchived)]);
      }
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to route grievance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    if (!selectedGrievance || saving || !isSuperadmin) return;
    try {
      setSaving(true);
      setReanalyzing(true);
      const { data } = await axios.put(`${API_BASE}/grievances/${selectedGrievance._id}/ai-analysis`,
        { version: selectedGrievance.__v }, { headers, timeout: 180000 });
      if (!data.success) throw new Error(data.message || 'Reanalysis failed');
      setSelectedGrievance(data.data);
      setGrievances((current) => current.map((item) => item._id === data.data._id ? { ...item, ...data.data } : item));
      void Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'AI analysis saved',
        showConfirmButton: false,
        timer: 1500,
      });
      await loadStats().catch((error) => console.error('Failed to refresh analysis stats:', error.message));
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Analysis unavailable', text: error.response?.data?.message || error.message });
    } finally {
      setReanalyzing(false);
      setSaving(false);
    }
  };

  const toggleArchivedView = async () => {
    const nextArchived = !showArchived;
    setShowArchived(nextArchived);
    try {
      setLoading(true);
      setGrievances([]);
      await Promise.all([loadStats(), loadGrievances(filters, nextArchived)]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load grievance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const exportFilters = showArchived ? filters : normalizeFiltersForView(filters, grievanceView);
      const response = await adminService.exportGrievances({
        search: exportFilters.search,
        status: exportFilters.status,
        priority: exportFilters.priority,
        office: exportFilters.office,
        month: exportFilters.month,
        archived: showArchived ? 'true' : 'false',
        grievanceView: showArchived ? '' : grievanceView,
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const monthSuffix = exportFilters.month || 'all';
      link.href = url;
      link.setAttribute('download', `grievances-${showArchived ? 'archived' : grievanceView}-${monthSuffix}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Grievance export downloaded for ${formatMonthLabel(filters.month)}`);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to export grievances', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedGrievance(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedGrievance(null);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedGrievance(null);
    setDeleteReason('');
  };

  const handleCloseRouteModal = () => {
    setShowRouteModal(false);
    setSelectedGrievance(null);
    setRouteCollege('');
    setRouteLevel('department');
    setRouteDepartment('');
  };

  const selectedRouteCategory = showRouteModal
    ? findRouteCategory(routeCollege, routeLevel, routeDepartment)
    : null;
  const concernedRouteDetails = showRouteModal && selectedGrievance
    ? resolveConcernedOfficeDetails(selectedGrievance)
    : null;
  const routeLevelMessage = routeLevel === 'department'
    ? 'Select a department within the chosen college.'
    : 'The grievance will be routed to the selected college-level office.';
  const routeValidationMessage = showRouteModal && routeCollege && !selectedRouteCategory
    ? routeLevel === 'department'
      ? routeDepartmentOptions.length
        ? 'Select an available department in this college before confirming.'
        : 'No active departments are configured for this college. Add a department in Office Manage or choose an available college-level destination.'
      : 'The selected college could not be matched to an active college-level office destination.'
    : '';
  const routeDepartmentIsListed = routeDepartmentOptions.some((office) =>
    normalizeOfficeKey(office?.department) === normalizeOfficeKey(routeDepartment)
  );
  const routeTargetDetails = selectedRouteCategory
    ? {
        college: selectedRouteCategory.college,
        department: selectedRouteCategory.department || '',
      }
    : null;
  const canSubmitRoute = Boolean(selectedRouteCategory);
  const isMemoCreatedView = !showArchived && grievanceView === 'memo_created';
  const isResolvedView = !showArchived && grievanceView === 'resolved';
  const isRejectedView = !showArchived && grievanceView === 'rejected';
  const currentViewCopy = getGrievanceViewCopy(grievanceView);
  const emptyTableMessage = showArchived ? 'No grievances found.' : currentViewCopy.empty;
  const currentTableLabel = showArchived ? 'Archived Grievances' : currentViewCopy.label;
  const helperMessage = showArchived
    ? 'Archived grievances include manually archived cases and monthly-reset resolved records. These entries stay available for audit and historical download.'
    : currentViewCopy.helper;
  const grievanceViewTabs = [
    ['all', 'All Grievances'],
    ['active', 'Active Grievances'],
    ['overdue', 'Active Overdue'],
    ['memo_created', 'Memo Created'],
    ['resolved', 'Resolved'],
    ['rejected', 'Rejected'],
  ];
  const statusFilterOptions = getAllowedStatusOptions(grievanceView);
  const showStatusDropdown = !isResolvedView && !isRejectedView;

  return (
    <div className="flex flex-col w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-left">
            <h2 className="text-white font-bold text-xl">Grievance Management</h2>
            <p className="text-white/80 text-sm">
              {showArchived ? 'Review archived grievance records' : 'Track grievance queues, status outcomes, and overdue memo handling'}
            </p>
          </div>
          <button
            onClick={toggleArchivedView}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            <ArchiveIcon />
            {showArchived ? 'Back to All' : 'Archived Grievance'}
          </button>
        </div>
      </div>

      {(error || success) && (
        <div className="px-8 pt-5">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>}
        </div>
      )}

      <div className="px-8 pt-6">
        <div className={`rounded-xl border px-4 py-3 text-sm ${showArchived ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {helperMessage}
        </div>
      </div>

      {!showArchived && (
        <div className="px-8 pt-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {grievanceViewTabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleGrievanceViewChange(value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  grievanceView === value
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label} ({viewCounts[value] ?? 0})
              </button>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="px-8 pt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['Total', stats.total],
            ['Pending', stats.pending],
            ['Rejected', stats.rejected],
            ['Resolved', stats.resolved],
            ['Resolution %', `${stats.resolutionRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="px-8 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search reference, subject, complainant..."
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          {showStatusDropdown ? (
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">{getStatusPlaceholder(grievanceView)}</option>
              {statusFilterOptions.map((s) => (
                <option key={s} value={s}>{fmtStatus(s)}</option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
              {isResolvedView ? 'Resolved' : 'Rejected'}
            </div>
          )}
          <select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">All Priority</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            value={filters.office}
            onChange={(e) => handleFilterChange('office', e.target.value)}
            placeholder="Office"
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="month"
            value={filters.month}
            onChange={(e) => handleFilterChange('month', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-500">
            {currentTableLabel}. Download uses the same filters shown in the table. Choose a month to export only that period.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {filters.month && (
              <button
                type="button"
                onClick={() => handleFilterChange('month', '')}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear Month
              </button>
            )}
            {canExportGrievances && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting ? 'Downloading...' : 'Download CSV'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading grievances...</div>
        ) : grievances.length === 0 ? (
          <div className="py-10 text-center text-gray-500">{emptyTableMessage}</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Tracking ID</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Concern</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Classified As</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Complainant</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Urgency</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Sentiment</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Office</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">SLA</th>
                  {isMemoCreatedView && (
                    <>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Memo Status</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Memo Created Date</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Memo Created By</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {grievances.map((g) => {
                  const routeDestination = resolveOfficeDestination(g);
                  const effectiveAnalysis = getEffectiveAiAnalysis(g);
                  const displayAiStatus = getAiStatusForDisplay(g);
                  const urgencyLabel = aiLabel(effectiveAnalysis, 'urgency', g.priority || '--', displayAiStatus);
                  const isClosedCase = ['resolved', 'rejected'].includes(g.status);
                  const canMarkMemoCreated = canEditGrievances && isActiveOverdueGrievance(g);
                  const urgencyClasses = urgencyTone(urgencyLabel, isClosedCase);
                  const rowClassName = urgencyClasses.row;

                  return (
                  <tr key={g._id} className={rowClassName}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <p className="font-semibold font-mono">{g.referenceNumber || g.trackingId}</p>
                      <p className="text-xs text-gray-500 mt-1">{fmtDate(g.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <p className="font-medium text-gray-900 max-w-xs truncate">{g.subject}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <p className="font-medium text-gray-900">
                        {aiLabel(effectiveAnalysis, 'category', g.category || '--', displayAiStatus)}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {g.aiAnalysisOverrideAt
                          ? `Admin edited: ${fmtEditedAt(g.aiAnalysisOverrideAt)}`
                          : aiMetaText(displayAiStatus, effectiveAnalysis?.category?.confidence)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">
                        {g.isAnonymous ? 'Anonymous' : (g.complainantName || g.complainantId?.name || '--')}
                      </p>
                      {!g.isAnonymous && (
                        <>
                          <p className="text-xs text-gray-500">{g.complainantEmail || g.complainantId?.email || '--'}</p>
                          <p className="text-xs text-gray-500">
                            {g.complainantId?.complainantType
                              ? g.complainantId.complainantType.charAt(0).toUpperCase() + g.complainantId.complainantType.slice(1)
                              : '--'}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <p className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyClasses.badge}`}>
                        {urgencyLabel}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {g.aiAnalysisOverrideAt
                          ? `Admin edited: ${fmtEditedAt(g.aiAnalysisOverrideAt)}`
                          : aiMetaText(displayAiStatus, effectiveAnalysis?.urgency?.confidence)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <p className="font-medium text-gray-900">
                        {aiLabel(effectiveAnalysis, 'sentiment', '--', displayAiStatus)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {g.aiAnalysisOverrideAt
                          ? `Admin edited: ${fmtEditedAt(g.aiAnalysisOverrideAt)}`
                          : aiMetaText(displayAiStatus, effectiveAnalysis?.sentiment?.confidence)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <p className="text-gray-900">{formatOfficeLabel(g.office || g.assignedTo?.office, { acronymOnly: true })}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatOfficeLabel(g.department)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge grievance={g} />
                      {g.archived && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          {g.archiveType === 'deleted'
                            ? 'Archived as deleted'
                            : g.archiveType === 'manual'
                              ? 'Archived manually'
                            : g.archiveType === 'monthly_reset'
                              ? 'Archived during monthly reset'
                              : 'Archived as rejected'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <SlaStatusBadge grievance={g} view={grievanceView} />
                    </td>
                    {isMemoCreatedView && (
                      <>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-sky-100 text-sky-800">
                            Memo Created
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {fmtDate(g.overdueMemoCreatedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">{g.overdueMemoCreatedBy?.name || '--'}</p>
                          <p className="text-xs text-gray-500">{g.overdueMemoCreatedBy?.email || ''}</p>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openViewModal(g)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          aria-label="View grievance"
                        >
                          <EyeIcon />
                        </button>
                        {canEditGrievances && (
                          <button
                            type="button"
                            onClick={() => !g.archived && openEditModal(g)}
                            disabled={g.archived}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Edit grievance"
                          >
                            <PencilIcon />
                          </button>
                        )}
                        {canMarkMemoCreated && (
                          <button
                            type="button"
                            onClick={() => handleMarkOverdueMemoCreated(g)}
                            disabled={saving}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Mark memo as created"
                            title="Mark Memo as Created"
                          >
                            <MemoIcon />
                          </button>
                        )}
                        {canArchiveGrievances && (
                          <button
                            type="button"
                            onClick={() => !g.archived && ['resolved', 'rejected'].includes(g.status) && openDeleteModal(g)}
                            disabled={g.archived || !['resolved', 'rejected'].includes(g.status)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Archive grievance"
                            title={
                              ['resolved', 'rejected'].includes(g.status)
                                ? 'Archive grievance'
                                : 'Only resolved or rejected grievances can be archived'
                            }
                          >
                            <ArchiveIcon />
                          </button>
                        )}
                        {isSuperadmin && (
                          <button
                            type="button"
                            onClick={() => !g.archived && routeDestination && openRouteModal(g)}
                            disabled={g.archived || !routeDestination}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Route grievance to office"
                            title={
                              routeDestination
                                ? `Route to ${routeDestination}`
                                : 'No office destination available'
                            }
                          >
                            <RouteIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} items)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showRouteModal && selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 flex items-center justify-between">
              <div className="text-white text-left">
                <h2 className="text-2xl font-bold">Route Grievance To Office</h2>
                <p className="text-white/80 text-sm">
                  Confirm if this grievance should be routed to the office below.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseRouteModal}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-violet-700 font-medium">Tracking ID</p>
                    <p className="text-gray-900 font-semibold">{selectedGrievance.referenceNumber || selectedGrievance.trackingId}</p>
                  </div>
                  <div>
                    <p className="text-violet-700 font-medium">Status</p>
                    <p className="text-gray-900 font-semibold">{fmtStatus(selectedGrievance.status)}</p>
                  </div>
                  <div>
                    <p className="text-violet-700 font-medium">Concern</p>
                    <p className="text-gray-900 font-semibold">{selectedGrievance.subject || '--'}</p>
                  </div>
                  <div>
                    <p className="text-violet-700 font-medium">Current Assignment</p>
                    <p className="text-gray-900 font-semibold">
                      {formatOfficeLabel(selectedGrievance.assignedTo?.office || selectedGrievance.office, { acronymOnly: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-violet-700 font-medium">Concerned Office</p>
                    <p className="text-gray-900 font-semibold">
                      {formatOfficeLabel(concernedRouteDetails?.college)}
                    </p>
                  </div>
                  <div>
                    <p className="text-violet-700 font-medium">Concerned Department</p>
                    <p className="text-gray-900 font-semibold">
                      {concernedRouteDetails?.department
                        ? formatOfficeLabel(concernedRouteDetails.department)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Final Routing</label>
                  <select
                    value={routeCollege}
                    onChange={(event) => {
                      const college = event.target.value;
                      const hasDepartments = offices.some((office) =>
                        normalizeOfficeKey(office.college) === normalizeOfficeKey(college) &&
                        String(office.department || '').trim()
                      );
                      setRouteCollege(college);
                      setRouteDepartment('');
                      setRouteLevel(routeLevel === 'college' && findRouteCategory(college, 'college')
                        ? 'college' : hasDepartments ? 'department' : 'college');
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="">Select college</option>
                    {collegeOptions.map((college) => (
                      <option key={college} value={college}>{formatOfficeLabel(college)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="block text-sm font-semibold text-slate-700 mb-2">Routing Level</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      routeLevel === 'college' ? 'border-violet-400 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="routeLevel"
                        value="college"
                        checked={routeLevel === 'college'}
                        onChange={() => {
                          setRouteLevel('college');
                          setRouteDepartment('');
                        }}
                        disabled={!findRouteCategory(routeCollege, 'college')}
                      />
                      <span>
                        <span className="block font-semibold">College-level</span>
                        <span className="text-xs text-slate-500">No department required</span>
                      </span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      routeLevel === 'department' ? 'border-violet-400 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="routeLevel"
                        value="department"
                        checked={routeLevel === 'department'}
                        onChange={() => {
                          setRouteLevel('department');
                        }}
                        disabled={routeDepartmentOptions.length === 0}
                      />
                      <span>
                        <span className="block font-semibold">Department-level</span>
                        <span className="text-xs text-slate-500">Select a department destination</span>
                      </span>
                    </label>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{routeLevelMessage}</p>
                </div>

                {routeLevel === 'department' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
                    <select
                      value={routeDepartment}
                      onChange={(event) => {
                        setRouteDepartment(event.target.value);
                      }}
                      disabled={routeDepartmentOptions.length === 0}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="">
                        {routeDepartmentOptions.length ? 'Select department' : 'No active departments available'}
                      </option>
                      {routeDepartment && !routeDepartmentIsListed && (
                        <option value={routeDepartment} disabled>{formatOfficeLabel(routeDepartment)} (unavailable)</option>
                      )}
                      {routeDepartmentOptions.map((office) => (
                        <option key={office.id || office.slug || office.name} value={office.department}>
                          {formatOfficeLabel(office.department)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  <span className="font-semibold">Selected destination:</span>{' '}
                  {routeTargetDetails
                    ? routeTargetDetails.department
                      ? `${formatOfficeLabel(routeTargetDetails.college)} / ${formatOfficeLabel(routeTargetDetails.department)}`
                      : `${formatOfficeLabel(routeTargetDetails.college)} / College-level`
                    : 'No valid destination selected'}
                </div>
                {routeValidationMessage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {routeValidationMessage}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-left">
                This will route the grievance to the selected office only. It will be visible to that office for review, but no specific office handler will be assigned automatically.
              </div>
            </div>

            <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseRouteModal}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRouteToOffice}
                disabled={saving || !canSubmitRoute}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Routing...' : 'Yes, Route to This Office'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GrievanceDetailsModal 
        isOpen={showDetailsModal} 
        grievance={selectedGrievance} 
        onClose={handleCloseModal} 
        currentUser={currentUser}
        onStatusChange={canEditGrievances ? handleAdminStatusUpdate : undefined}
        saving={saving}
      />
      <GrievanceEditModal
        reanalyzing={reanalyzing}
        onReanalyze={isSuperadmin ? handleReanalyze : undefined}
        isOpen={showEditModal}
        grievance={selectedGrievance}
        offices={offices}
        value={editForm}
        saving={saving}
        currentUser={currentUser}
        onChange={setEditForm}
        onSave={handleSaveEdit}
        onClose={handleCloseEditModal}
      />
      <GrievanceDeleteModal
        isOpen={showDeleteModal}
        grievance={selectedGrievance}
        reason={deleteReason}
        saving={saving}
        onChangeReason={setDeleteReason}
        onDelete={handleArchiveDelete}
        onClose={handleCloseDeleteModal}
      />
    </div>
  );
};

export default GrievanceManagementModule;

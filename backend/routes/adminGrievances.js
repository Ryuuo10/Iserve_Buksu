const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Grievance = require('../models/Grievance');
const User = require('../models/User');
const OfficeCategory = require('../models/OfficeCategory');
const Notification = require('../models/Notification');
const { authenticateToken, checkRole, requirePermission } = require('../middleware/auth');
const {
  notifyAdminsGrievanceSubmitted,
  notifyComplainantGrievanceArchived,
  notifyComplainantGrievanceAssigned,
  notifyComplainantGrievanceStatusUpdated,
  notifyComplainantGrievanceSubmitted,
  notifyOfficeHandlerAssignment,
  notifyOfficeHandlersGrievanceRouted,
} = require('../services/notificationService');
const {
  updateWithOptimisticLock,
  executeTransaction,
  updateWithLockAndTransaction,
  formatConflictResponse,
} = require('../utils/concurrencyUtils');
const { runMonthlyGrievanceArchiveIfNeeded } = require('../utils/grievanceMonthlyArchive');
const {
  notifyConflict,
  broadcastUpdateWarning,
  broadcastSuccessfulUpdate,
} = require('../utils/socketEvents');
const { slugifyCategoryName } = require('../utils/officeCategoryCatalog');
const {
  getComplainantIdentity,
  sanitizeAnonymousText,
  sanitizeAnonymousTranscript,
  sanitizeAnonymousGrievanceForResponse,
  sanitizeAnonymousGrievancesForResponse,
} = require('../utils/anonymousSanitizer');
const {
  OPEN_GRIEVANCE_STATUSES,
  getGrievanceOverdueDeadline,
  isOpenGrievanceStatus,
  isGrievanceOverdue,
} = require('../utils/grievanceSla');
const REVIEW_STATUS = ['pending', 'under_review', 'assigned_to_department', 'rejected'];
const ALL_STATUS = ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'resolved', 'rejected', 'escalated'];
const ALLOWED_PRIORITY = ['low', 'medium', 'high', 'critical'];
const OPEN_STATUS = OPEN_GRIEVANCE_STATUSES;
const GRIEVANCE_VIEW = {
  ALL: 'all',
  ACTIVE: 'active',
  OVERDUE: 'overdue',
  MEMO_CREATED: 'memo_created',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveOfficeCategorySelection = async (value = '') => {
  const normalizedValue = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalizedValue) {
    return null;
  }

  const normalizedSlug = slugifyCategoryName(normalizedValue);
  const selectFields = 'name slug college department';

  const exactSlugMatch = await OfficeCategory.findOne({
    status: 'active',
    slug: { $in: [normalizedValue, normalizedSlug] },
  }).select(selectFields);
  if (exactSlugMatch) {
    return exactSlugMatch;
  }

  const exactNameMatch = await OfficeCategory.findOne({
    status: 'active',
    $or: [
      { name: normalizedValue },
      { name: { $regex: `^${escapeRegex(normalizedValue)}$`, $options: 'i' } },
    ],
  }).select(selectFields);
  if (exactNameMatch) {
    return exactNameMatch;
  }

  return OfficeCategory.findOne({
    status: 'active',
    college: { $regex: `^${escapeRegex(normalizedValue)}$`, $options: 'i' },
    department: { $in: [null, ''] },
  }).select(selectFields);
};

const sanitizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .filter((attachment) => attachment && attachment.url)
    .map((attachment) => ({
      url: String(attachment.url).trim(),
      publicId: attachment.publicId ? String(attachment.publicId).trim() : null,
      fileName: attachment.fileName
        ? String(attachment.fileName).trim()
        : attachment.originalName
          ? String(attachment.originalName).trim()
          : null,
      fileType: attachment.fileType
        ? String(attachment.fileType).trim()
        : attachment.format
          ? String(attachment.format).trim()
          : null,
      size: Number.isFinite(attachment.size) ? attachment.size : null,
    }));
};

const sanitizeConversationTranscript = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const rawSender = String(entry.sender || entry.role || '').trim().toLowerCase();
      const sender = rawSender === 'assistant' || rawSender === 'bot' ? 'bot' : rawSender === 'user' ? 'user' : '';
      const message = String(entry.message || entry.text || entry.content || '').trim();
      const parsedTimestamp = entry.timestamp || entry.createdAt || entry.time;
      const timestamp = parsedTimestamp ? new Date(parsedTimestamp) : new Date();

      if (!sender || !message) {
        return null;
      }

      return {
        sender,
        message: message.slice(0, 5000),
        timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      };
    })
    .filter(Boolean)
    .slice(0, 200);
};

const escCSV = (v) => {
  if (v == null) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
};

const makeReferenceNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `GRV-${year}-${random}`;
};

const makeTrackingId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `TRK-${year}-${random}`;
};

const makeGrievanceId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `GID-${year}-${random}`;
};

const adminGuard = [authenticateToken, checkRole('admin', 'superadmin')];

const normalizeMonthDateRange = ({ month = '', startDate = '', endDate = '' } = {}) => {
  if (!month) {
    return { startDate, endDate };
  }

  const [yearText, monthText] = String(month).split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { startDate, endDate };
  }

  const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return {
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10),
  };
};

const buildAdminGrievanceQuery = ({
  search = '',
  status = '',
  priority = '',
  category = '',
  office = '',
  archived = '',
  grievanceView = '',
  overdueMemoStatus = '',
  startDate = '',
  endDate = '',
  month = '',
  now = Date.now(),
} = {}) => {
  const query = {};
  const normalizedRange = normalizeMonthDateRange({ month, startDate, endDate });

  if (search) {
    query.$or = [
      { referenceNumber: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { complainantName: { $regex: search, $options: 'i' } },
      { complainantEmail: { $regex: search, $options: 'i' } },
    ];
  }

  if (status) query.status = status;
  if (priority) {
    query.priority = priority === 'critical' ? { $in: ['critical', 'urgent'] } : priority;
  }
  if (category) query.category = category;
  if (office) query.office = office;

  if (archived === 'true') {
    query.archived = true;
  } else if (archived === 'false' || archived === '' || archived == null) {
    query.archived = { $ne: true };
  }

  const normalizedGrievanceView = normalizeGrievanceView({ grievanceView, overdueMemoStatus });

  if (normalizedGrievanceView === GRIEVANCE_VIEW.ALL) {
    query.archived = { $ne: true };
  } else if (normalizedGrievanceView === GRIEVANCE_VIEW.ACTIVE) {
    const overdueDeadline = getGrievanceOverdueDeadline(now);
    query.archived = { $ne: true };
    query.createdAt = { ...(query.createdAt || {}), $gt: overdueDeadline };

    if (!status) {
      query.status = { $in: OPEN_STATUS };
    } else if (!OPEN_STATUS.includes(status)) {
      query.status = '__no_matching_active_status__';
    }

    query.overdueMemoCreated = { $ne: true };
  } else if (normalizedGrievanceView === GRIEVANCE_VIEW.OVERDUE) {
    const overdueDeadline = getGrievanceOverdueDeadline(now);
    query.archived = { $ne: true };
    query.createdAt = { ...(query.createdAt || {}), $lte: overdueDeadline };

    if (!status) {
      query.status = { $in: OPEN_STATUS };
    } else if (!OPEN_STATUS.includes(status)) {
      query.status = '__no_matching_overdue_status__';
    }

    query.overdueMemoCreated = { $ne: true };
  } else if (normalizedGrievanceView === GRIEVANCE_VIEW.MEMO_CREATED) {
    query.archived = { $ne: true };
    query.overdueMemoCreated = true;
  } else if (normalizedGrievanceView === GRIEVANCE_VIEW.RESOLVED) {
    query.archived = { $ne: true };
    query.status = !status || status === 'resolved' ? 'resolved' : '__no_matching_resolved_status__';
  } else if (normalizedGrievanceView === GRIEVANCE_VIEW.REJECTED) {
    query.archived = { $ne: true };
    query.status = !status || status === 'rejected' ? 'rejected' : '__no_matching_rejected_status__';
  }

  if (normalizedRange.startDate || normalizedRange.endDate) {
    query.createdAt = query.createdAt || {};
    if (normalizedRange.startDate) query.createdAt.$gte = new Date(normalizedRange.startDate);
    if (normalizedRange.endDate) {
      const rangeEnd = new Date(`${normalizedRange.endDate}T23:59:59.999Z`);
      query.createdAt.$lte = query.createdAt.$lte && query.createdAt.$lte < rangeEnd
        ? query.createdAt.$lte
        : rangeEnd;
    }
  }

  return query;
};

const normalizeGrievanceView = ({ grievanceView = '', overdueMemoStatus = '' } = {}) => {
  const requestedView = String(grievanceView || '').trim().toLowerCase();
  if (Object.values(GRIEVANCE_VIEW).includes(requestedView)) {
    return requestedView;
  }

  const legacyMemoStatus = String(overdueMemoStatus || '').trim().toLowerCase();
  if (legacyMemoStatus === 'active') {
    return GRIEVANCE_VIEW.OVERDUE;
  }
  if (legacyMemoStatus === 'memo_created') {
    return GRIEVANCE_VIEW.MEMO_CREATED;
  }

  return '';
};

const buildGrievanceViewCounts = async (filters = {}, now = Date.now()) => {
  const baseFilters = {
    ...filters,
    archived: 'false',
    overdueMemoStatus: '',
    now,
  };

  const [all, active, overdue, memoCreated, resolved, rejected] = await Promise.all([
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.ALL })),
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.ACTIVE })),
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.OVERDUE })),
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.MEMO_CREATED })),
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.RESOLVED })),
    Grievance.countDocuments(buildAdminGrievanceQuery({ ...baseFilters, grievanceView: GRIEVANCE_VIEW.REJECTED })),
  ]);

  return {
    all,
    active,
    overdue,
    memo_created: memoCreated,
    resolved,
    rejected,
  };
};

const isActiveOverdueGrievance = (grievance, now = Date.now()) => {
  if (!grievance || grievance.archived || grievance.overdueMemoCreated === true) {
    return false;
  }

  if (!isOpenGrievanceStatus(grievance.status)) {
    return false;
  }

  return isGrievanceOverdue(grievance, now);
};

const getAuthenticatedUserId = (user) => user?._id || user?.id || user?.userId || null;

const buildPriorityQueueQuery = ({
  search = '',
  status = '',
  priority = '',
  office = '',
} = {}) => {
  const query = buildAdminGrievanceQuery({
    search,
    priority,
    office,
    archived: 'false',
  });

  if (status) {
    if (OPEN_STATUS.includes(status)) {
      query.status = status;
    } else {
      query.status = '__no_matching_queue_status__';
    }
  } else {
    query.status = { $in: OPEN_STATUS };
  }

  return query;
};

const buildPriorityRankExpression = () => ({
  $switch: {
    branches: [
      { case: { $in: ['$priority', ['critical', 'urgent']] }, then: 0 },
      { case: { $eq: ['$priority', 'high'] }, then: 1 },
      { case: { $eq: ['$priority', 'medium'] }, then: 2 },
      { case: { $eq: ['$priority', 'low'] }, then: 3 },
    ],
    default: 4,
  },
});

const buildStatusRankExpression = () => ({
  $switch: {
    branches: [
      { case: { $eq: ['$status', 'pending'] }, then: 0 },
      { case: { $eq: ['$status', 'under_review'] }, then: 1 },
      { case: { $eq: ['$status', 'assigned_to_department'] }, then: 2 },
      { case: { $eq: ['$status', 'in_progress'] }, then: 3 },
      { case: { $eq: ['$status', 'escalated'] }, then: 4 },
    ],
    default: 5,
  },
});

const startOfUtcWeek = (dateInput) => {
  const date = new Date(dateInput);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
};

const formatWeekLabel = (dateInput) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateInput);

const formatRelativeTime = (dateInput) => {
  if (!dateInput) {
    return 'No recent activity';
  }

  const diffMs = Date.now() - new Date(dateInput).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const normalizePriority = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'urgent') {
    return 'critical';
  }

  return ['critical', 'high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
};

const buildMonthlyTrend = async (now = new Date()) => {
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1, 0, 0, 0, 0));
  const resolutionHourDivisor = 1000 * 60 * 60;

  const [filedRows, resolvedRows, pendingRows] = await Promise.all([
    Grievance.aggregate([
      { $match: { createdAt: { $gte: startMonth } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Grievance.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedAt: { $gte: startMonth, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$resolvedAt' },
            month: { $month: '$resolvedAt' },
          },
          count: { $sum: 1 },
          avgResolutionHours: {
            $avg: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, resolutionHourDivisor],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Grievance.aggregate([
      {
        $match: {
          archived: { $ne: true },
          status: { $in: OPEN_STATUS },
          createdAt: { $gte: startMonth },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const filedMap = new Map(filedRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));
  const resolvedMap = new Map(resolvedRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));
  const avgResolutionHoursMap = new Map(
    resolvedRows.map((row) => [
      `${row._id.year}-${row._id.month}`,
      row.avgResolutionHours ? Number(row.avgResolutionHours.toFixed(1)) : 0,
    ])
  );
  const pendingMap = new Map(pendingRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));

  const trend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth() + 1;
    const key = `${year}-${month}`;

    trend.push({
      label: `${MONTHS[month - 1]} ${year}`,
      filed: filedMap.get(key) || 0,
      resolved: resolvedMap.get(key) || 0,
      avgResolutionHours: avgResolutionHoursMap.get(key) || 0,
      pending: pendingMap.get(key) || 0,
    });
  }

  return trend;
};

const buildWeeklyTrend = async (now = new Date()) => {
  const currentWeekStart = startOfUtcWeek(now);
  const firstWeekStart = new Date(currentWeekStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - 5 * 7);

  const [filedRows, resolvedRows] = await Promise.all([
    Grievance.aggregate([
      {
        $match: {
          createdAt: { $gte: firstWeekStart },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$createdAt',
              unit: 'week',
              startOfWeek: 'monday',
              timezone: 'UTC',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Grievance.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedAt: { $gte: firstWeekStart, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$resolvedAt',
              unit: 'week',
              startOfWeek: 'monday',
              timezone: 'UTC',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const filedMap = new Map(filedRows.map((row) => [new Date(row._id).toISOString(), row.count]));
  const resolvedMap = new Map(resolvedRows.map((row) => [new Date(row._id).toISOString(), row.count]));

  const trend = [];
  for (let i = 0; i < 6; i += 1) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCDate(firstWeekStart.getUTCDate() + i * 7);
    const key = weekStart.toISOString();

    trend.push({
      label: formatWeekLabel(weekStart),
      filed: filedMap.get(key) || 0,
      resolved: resolvedMap.get(key) || 0,
    });
  }

  return trend;
};

const getAverageResolutionTimeHours = async () => {
  const [result] = await Grievance.aggregate([
    {
      $match: {
        archived: { $ne: true },
        status: 'resolved',
        resolvedAt: { $ne: null },
      },
    },
    {
      $project: {
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
        },
      },
    },
    {
      $group: {
        _id: null,
        average: { $avg: '$resolutionHours' },
      },
    },
  ]);

  return result?.average ? Number(result.average.toFixed(1)) : 0;
};

router.get('/grievances', ...adminGuard, requirePermission('grievances.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      priority = '',
      category = '',
      office = '',
      archived = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate = '',
      endDate = '',
      month = '',
      grievanceView = '',
      overdueMemoStatus = '',
    } = req.query;
    await runMonthlyGrievanceArchiveIfNeeded();
    const requestNow = Date.now();
    const normalizedGrievanceView = normalizeGrievanceView({ grievanceView, overdueMemoStatus });
    const query = buildAdminGrievanceQuery({
      search,
      status,
      priority,
      category,
      office,
      archived,
      grievanceView,
      overdueMemoStatus,
      startDate,
      endDate,
      month,
      now: requestNow,
    });

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;

    const allowedSort = ['createdAt', 'updatedAt', 'priority', 'status', 'referenceNumber', 'archivedAt'];
    const defaultSortBy = archived === 'true' ? 'archivedAt' : 'createdAt';
    const safeSortBy = allowedSort.includes(sortBy) ? sortBy : defaultSortBy;
    const safeSortOrder = sortOrder === 'asc' ? 1 : -1;
    const sortOptions = { [safeSortBy]: safeSortOrder };

    const countFilters = { search, status, priority, category, office, startDate, endDate, month };
    const [grievances, total, viewCounts] = await Promise.all([
      Grievance.find(query)
        .populate('assignedTo', 'name email office')
        .populate('complainantId', 'name email contact phone complainantType')
        .populate('lastUpdatedBy', 'name email office role')
        .populate('overdueMemoCreatedBy', 'name email office role')
        .populate('rootCauseAnalysis.completedBy', 'name email office role')
        .sort(sortOptions)
        .skip(skip)
        .limit(parsedLimit),
      Grievance.countDocuments(query),
      archived === 'true' ? Promise.resolve(null) : buildGrievanceViewCounts(countFilters, requestNow),
    ]);

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievancesForResponse(grievances),
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        totalItems: total,
        itemsPerPage: parsedLimit,
        hasNextPage: skip + parsedLimit < total,
        hasPreviousPage: parsedPage > 1,
      },
      viewCounts,
      filters: {
        search,
        status,
        priority,
        category,
        office,
        archived,
        grievanceView: normalizedGrievanceView,
        overdueMemoStatus,
        sortBy: safeSortBy,
        sortOrder,
        startDate,
        endDate,
        month,
      },
    });
  } catch (error) {
    console.error('Get grievances error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievances' });
  }
});

router.get('/grievances/queue', ...adminGuard, requirePermission('grievances.view'), async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      priority = '',
      office = '',
      limit = 12,
    } = req.query;

    await runMonthlyGrievanceArchiveIfNeeded();

    const parsedLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
    const query = buildPriorityQueueQuery({ search, status, priority, office });

    let queue = await Grievance.aggregate([
      { $match: query },
      {
        $addFields: {
          priorityRank: buildPriorityRankExpression(),
          statusRank: buildStatusRankExpression(),
        },
      },
      {
        $sort: {
          priorityRank: 1,
          statusRank: 1,
          createdAt: 1,
          updatedAt: -1,
        },
      },
      { $limit: parsedLimit },
    ]);

    queue = await Grievance.populate(queue, [
      { path: 'assignedTo', select: 'name email office' },
      { path: 'complainantId', select: 'name email contact phone' },
      { path: 'lastUpdatedBy', select: 'name email office role' },
      { path: 'rootCauseAnalysis.completedBy', select: 'name email office role' },
    ]);

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievancesForResponse(queue),
    });
  } catch (error) {
    console.error('Get grievance queue error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance queue' });
  }
});

router.put('/grievances/:id', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    const { status, office, version, aiAnalysisOverride, aiAnalysisOverrideEnabled } = req.body;
    const grievanceId = req.params.id;
    let existingGrievance;

    // Load existing grievance
    const existing = await Grievance.findById(grievanceId).select(
      'complainantId referenceNumber status priority office department assignedTo assignedBy assignedAt underReviewAt departmentAssignedAt officeReceivedAt __v'
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    existingGrievance = existing;

    // Validate status if provided
    if (status && !REVIEW_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const update = {
      lastUpdatedBy: req.user._id,
    };

    const normalizeOverrideText = (value) => {
      const text = String(value || '').trim();
      return text ? text : null;
    };
    const normalizeOverrideConfidence = (value) => {
      if (value == null || value === '') return null;
      const numeric = Number(value);
      if (Number.isNaN(numeric)) return null;
      const normalized = numeric <= 1 ? numeric * 100 : numeric;
      if (Number.isNaN(normalized)) return null;
      return Math.max(0, Math.min(100, normalized));
    };
    const buildAiOverridePayload = (payload = {}) => {
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      const summary = normalizeOverrideText(payload.summary);
      const categoryLabel = normalizeOverrideText(payload.category?.label);
      const urgencyLabel = normalizeOverrideText(payload.urgency?.label);
      const sentimentLabel = normalizeOverrideText(payload.sentiment?.label);
      const categoryConfidence = normalizeOverrideConfidence(payload.category?.confidence);
      const urgencyConfidence = normalizeOverrideConfidence(payload.urgency?.confidence);
      const sentimentConfidence = normalizeOverrideConfidence(payload.sentiment?.confidence);

      if (!summary && !categoryLabel && !urgencyLabel && !sentimentLabel &&
        categoryConfidence == null && urgencyConfidence == null && sentimentConfidence == null) {
        return null;
      }

      return {
        summary,
        category: {
          label: categoryLabel,
          confidence: categoryConfidence,
        },
        urgency: {
          label: urgencyLabel,
          confidence: urgencyConfidence,
        },
        sentiment: {
          label: sentimentLabel,
          confidence: sentimentConfidence,
        },
      };
    };

    if (typeof office === 'string') {
      const normalizedOffice = office.trim();
      if (!normalizedOffice) {
        update.office = null;
        update.department = null;
        update.assignedTo = null;
        update.assignedBy = null;
        update.handlingLockedBy = null;
        update.handlingLockedAt = null;
        update.handlingLockSessionId = null;
        update.assignedAt = null;
        update.departmentAssignedAt = null;
        update.officeReceivedAt = null;
      } else {
        const officeCategory = await resolveOfficeCategorySelection(normalizedOffice);
        update.office = officeCategory?.name || normalizedOffice;
        update.department = officeCategory?.department || null;

        const officeChanged =
          String(existing.office || '').trim() !== String(update.office || '').trim() ||
          String(existing.department || '').trim() !== String(update.department || '').trim();

        if (officeChanged) {
          update.assignedTo = null;
          update.assignedBy = null;
          update.handlingLockedBy = null;
          update.handlingLockedAt = null;
          update.handlingLockSessionId = null;
          update.assignedAt = null;
          update.departmentAssignedAt = null;
          update.officeReceivedAt = null;

          if (!status && ['assigned_to_department', 'in_progress', 'escalated'].includes(existing.status)) {
            update.status = 'under_review';
            update.underReviewAt = new Date();
            update.inProgressAt = null;
            update.escalatedAt = null;
            update.resolvedAt = null;
          }
        }
      }
    }

    if (aiAnalysisOverrideEnabled !== undefined && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmins can override AI analysis.',
      });
    }

    if (aiAnalysisOverrideEnabled === false) {
      update.aiAnalysisOverride = null;
      update.aiAnalysisOverrideBy = null;
      update.aiAnalysisOverrideAt = null;
    } else if (aiAnalysisOverrideEnabled === true) {
      const overridePayload = buildAiOverridePayload(aiAnalysisOverride);
      update.aiAnalysisOverride = overridePayload;
      update.aiAnalysisOverrideBy = overridePayload ? req.user._id : null;
      update.aiAnalysisOverrideAt = overridePayload ? new Date() : null;
    }

    if (status) {
      const now = new Date();
      update.status = status;
      update.resolvedAt = null;
      if (status === 'pending') {
        update.underReviewAt = null;
        update.handlingLockedBy = null;
        update.handlingLockedAt = null;
        update.handlingLockSessionId = null;
        update.departmentAssignedAt = null;
        update.inProgressAt = null;
        update.escalatedAt = null;
      }
      if (status === 'under_review') {
        update.underReviewAt = now;
        update.handlingLockedBy = null;
        update.handlingLockedAt = null;
        update.handlingLockSessionId = null;
      }
      if (status === 'assigned_to_department') {
        update.departmentAssignedAt = now;
      }
      if (status === 'rejected') {
        update.handlingLockedBy = null;
        update.handlingLockedAt = null;
        update.handlingLockSessionId = null;
      }
    }

    // Use optimistic locking if version provided
    let grievance;
    if (version !== undefined) {
      // Use locked transaction update
      const result = await updateWithLockAndTransaction(
        Grievance,
        grievanceId,
        async (doc, session) => {
          const updated = await Grievance.findByIdAndUpdate(grievanceId, update, {
            new: true,
            session,
            runValidators: true,
          })
            .populate('assignedTo', 'name email office')
            .populate('complainantId', 'name email contact phone complainantType')
            .session(session);
          return updated;
        },
        version
      );

      if (!result.success) {
        if (result.conflict) {
          // Conflict detected
          const io = req.app.get('io');
          if (io) {
            notifyConflict(io, req.user._id, grievanceId, {
              currentVersion: result.currentVersion,
              currentState: {
                status: existingGrievance.status,
                priority: existingGrievance.priority,
                lastUpdatedBy: existingGrievance.lastUpdatedBy,
                updatedAt: existingGrievance.updatedAt,
              },
              updatedBy: existingGrievance.lastUpdatedBy,
              updatedByName: 'Another Administrator',
            });
          }

          return res.status(result.statusCode).json(
            formatConflictResponse(existingGrievance, { status, office })
          );
        }
        return res.status(result.statusCode).json({ success: false, message: result.error });
      }

      grievance = result.data;
    } else {
      // Fallback: simple update without version check
      grievance = await Grievance.findByIdAndUpdate(grievanceId, update, { new: true })
        .populate('assignedTo', 'name email office')
        .populate('complainantId', 'name email contact phone complainantType');

      if (!grievance) {
        return res.status(404).json({ success: false, message: 'Grievance not found' });
      }
    }

    // Send notification if status changed
    if (status && existingGrievance.status !== status) {
      await notifyComplainantGrievanceStatusUpdated({
        grievance,
        actor: req.user,
        previousStatus: existingGrievance.status,
        status,
        resolutionNotes: '',
      });
    }

    // Broadcast update
    const io = req.app.get('io');
    if (io && status) {
      broadcastSuccessfulUpdate(io, grievanceId, {
        version: grievance.__v,
        updatedByName: req.user.name,
        changes: { status, office },
        newStatus: status,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Grievance updated successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Admin update grievance error:', error);
    return res.status(500).json({ success: false, message: 'Error updating grievance' });
  }
});

router.get('/grievances/stats', ...adminGuard, requirePermission('grievances.view'), async (req, res) => {
  try {
    await runMonthlyGrievanceArchiveIfNeeded();
    const [total, pending, inProgress, resolved, rejected, escalated, byPriority, byCategory] = await Promise.all([
      Grievance.countDocuments({ archived: { $ne: true } }),
      Grievance.countDocuments({ archived: { $ne: true }, status: { $in: ['pending', 'under_review', 'assigned_to_department'] } }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'in_progress' }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'resolved' }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'rejected' }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'escalated' }),
      Grievance.aggregate([{ $match: { archived: { $ne: true } } }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Grievance.aggregate([{ $match: { archived: { $ne: true } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);

    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    byPriority.forEach((row) => {
      const priorityKey = row._id === 'urgent' ? 'critical' : row._id;
      if (priorityKey && priorityCounts[priorityKey] != null) {
        priorityCounts[priorityKey] += row.count;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        resolved,
        rejected,
        escalated,
        resolutionRate: total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 0,
        priorityCounts,
        categoryBreakdown: byCategory
          .filter((row) => !!row._id)
          .slice(0, 6)
          .map((row) => ({ name: row._id, count: row.count })),
      },
    });
  } catch (error) {
    console.error('Get grievance stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance statistics' });
  }
});

router.get('/analytics', ...adminGuard, requirePermission('analytics.view'), async (req, res) => {
  try {
    await runMonthlyGrievanceArchiveIfNeeded();
    const [totalCases, pending, inProgress, resolved, totalUsers, activeUsers, totalOffices, avgResponseTime, monthlyTrend] =
      await Promise.all([
        Grievance.countDocuments({ archived: { $ne: true } }),
        Grievance.countDocuments({ archived: { $ne: true }, status: { $in: ['pending', 'under_review', 'assigned_to_department'] } }),
        Grievance.countDocuments({ archived: { $ne: true }, status: 'in_progress' }),
        Grievance.countDocuments({ archived: { $ne: true }, status: 'resolved' }),
        User.countDocuments({ status: { $ne: 'blocked' } }),
        User.countDocuments({ status: 'active' }),
        OfficeCategory.countDocuments({ status: 'active' }),
        getAverageResolutionTimeHours(),
        buildMonthlyTrend(),
      ]);

    const resolutionRate = totalCases > 0 ? Number(((resolved / totalCases) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCases,
          resolved,
          pending,
          inProgress,
          avgResponseTime,
          avgResolutionHours: avgResponseTime,
          resolutionRate,
          totalUsers,
          activeUsers,
          totalOffices,
        },
        monthlyTrend,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching analytics data' });
  }
});

router.post('/grievances', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    const {
      subject,
      description,
      originalDescription = '',
      rawTranscript = '',
      category = 'general',
      office = null,
      department = null,
      incidentDate = null,
      priority = 'medium',
      complainantName = null,
      complainantEmail = null,
      complainantId = null,
      isAnonymous = false,
      attachments = [],
      aiAnalysis = null,
      conversationTranscript = [],
      chatHistory = [],
      messages = [],
    } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }

    if (!ALLOWED_PRIORITY.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value' });
    }

    let referenceNumber = makeReferenceNumber();
    while (await Grievance.exists({ referenceNumber })) {
      referenceNumber = makeReferenceNumber();
    }

    let trackingId = makeTrackingId();
    while (await Grievance.exists({ trackingId })) {
      trackingId = makeTrackingId();
    }

    let grievanceId = makeGrievanceId();
    while (await Grievance.exists({ grievanceId })) {
      grievanceId = makeGrievanceId();
    }

    const conversationSource = Array.isArray(conversationTranscript) && conversationTranscript.length
      ? conversationTranscript
      : Array.isArray(chatHistory) && chatHistory.length
        ? chatHistory
        : Array.isArray(messages)
          ? messages
          : [];
    const sanitizedConversationTranscript = sanitizeConversationTranscript(conversationSource);
    const complainantUser = isAnonymous && complainantId && mongoose.Types.ObjectId.isValid(complainantId)
      ? await User.findById(complainantId).select('name email contact phone givenName familyName')
      : null;
    const complainantIdentity = getComplainantIdentity(
      {
        complainantId: complainantUser,
        complainantName,
        complainantEmail,
      },
      {}
    );
    const anonymousSubmission = !!isAnonymous;
    const safeSubject = anonymousSubmission ? sanitizeAnonymousText(subject, complainantIdentity) : String(subject).trim();
    const safeDescription = anonymousSubmission ? sanitizeAnonymousText(description, complainantIdentity) : String(description).trim();
    const safeOriginalDescription = anonymousSubmission
      ? sanitizeAnonymousText(String(rawTranscript || originalDescription || description).trim(), complainantIdentity)
      : String(rawTranscript || originalDescription || description).trim();
    const protectedConversationTranscript = anonymousSubmission
      ? sanitizeAnonymousTranscript(sanitizedConversationTranscript, complainantIdentity)
      : sanitizedConversationTranscript;

    const grievance = await Grievance.create({
      grievanceId,
      trackingId,
      referenceNumber,
      subject: safeSubject,
      description: safeDescription,
      originalDescription: safeOriginalDescription,
      category: String(category).trim() || 'general',
      office: office ? String(office).trim() : null,
      department: department ? String(department).trim() : null,
      incidentDate: incidentDate ? String(incidentDate).trim() : null,
      priority,
      complainantId,
      complainantName: anonymousSubmission ? null : complainantName ? String(complainantName).trim() : null,
      complainantEmail: anonymousSubmission ? null : complainantEmail ? String(complainantEmail).trim().toLowerCase() : null,
      isAnonymous: anonymousSubmission,
      attachments: sanitizeAttachments(attachments),
      conversationTranscript: protectedConversationTranscript,
      aiAnalysis,
      lastUpdatedBy: req.user._id,
    });

    await notifyComplainantGrievanceSubmitted({
      grievance,
      actor: req.user,
    });

    await notifyAdminsGrievanceSubmitted({
      grievance,
      actor: req.user,
    });

    // Attempt auto-assignment to appropriate office handler
    console.log(`📮 Attempting auto-assignment for grievance ${grievance.referenceNumber} (office: ${grievance.office})`);
    return res.status(201).json({
      success: true,
      message: 'Grievance created successfully (pending review)',
      data: sanitizeAnonymousGrievanceForResponse(grievance, complainantIdentity),
      autoAssigned: false,
      assignmentStatus: 'pending-review',
    });
  } catch (error) {
    console.error('Create grievance error:', error);
    return res.status(500).json({ success: false, message: 'Error creating grievance' });
  }
});

router.put('/grievances/:id/status', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    const { status, resolutionNotes = '', version } = req.body;
    if (!REVIEW_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const grievanceId = req.params.id;
    const trimmedResolutionNotes = String(resolutionNotes || '').trim();
    let existingGrievance;

    // If version provided, use optimistic locking with transaction
    if (version !== undefined) {
      // Wrap in transaction for atomicity
      const result = await updateWithLockAndTransaction(
        Grievance,
        grievanceId,
        async (doc, session) => {
          // Prepare update data
          const now = new Date();
          const update = {
            status,
            resolutionNotes: trimmedResolutionNotes,
            lastUpdatedBy: req.user._id,
            resolvedAt: null,
          };
          if (status === 'pending') {
            update.underReviewAt = null;
            update.departmentAssignedAt = null;
            update.inProgressAt = null;
            update.escalatedAt = null;
          }
          if (status === 'under_review') {
            update.underReviewAt = now;
          }
          if (status === 'assigned_to_department') {
            update.departmentAssignedAt = now;
          }

          // Perform update within transaction
          const updated = await Grievance.findByIdAndUpdate(
            grievanceId,
            update,
            { new: true, session, runValidators: true }
          );

          existingGrievance = doc;
          return updated;
        },
        version
      );

      if (!result.success) {
        if (result.conflict) {
          // Conflict detected - notify user via Socket.io
          const io = req.app.get('io');
          if (io) {
            notifyConflict(io, req.user._id, grievanceId, {
              currentVersion: result.currentVersion,
              currentState: {
                status: existingGrievance?.status,
                priority: existingGrievance?.priority,
                lastUpdatedBy: existingGrievance?.lastUpdatedBy,
                updatedAt: existingGrievance?.updatedAt,
              },
              updatedBy: existingGrievance?.lastUpdatedBy,
              updatedByName: 'Another Administrator',
            });
          }

          return res.status(result.statusCode).json(
            formatConflictResponse(existingGrievance, { status, resolutionNotes })
          );
        }
        return res.status(result.statusCode).json({ success: false, message: result.error });
      }

      const grievance = result.data;

      // Send notification (outside transaction to not affect core operation)
      await notifyComplainantGrievanceStatusUpdated({
        grievance,
        actor: req.user,
        previousStatus: existingGrievance.status,
        status,
        resolutionNotes: trimmedResolutionNotes,
      });

      // Broadcast successful update
      const io = req.app.get('io');
      if (io) {
        broadcastSuccessfulUpdate(io, grievanceId, {
          version: grievance.__v,
          updatedByName: req.user.name,
          changes: { status, resolutionNotes: trimmedResolutionNotes },
          newStatus: status,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Grievance status updated successfully',
        data: sanitizeAnonymousGrievanceForResponse(grievance),
      });
    }

    // Fallback: if no version provided (for backward compatibility)
    existingGrievance = await Grievance.findById(grievanceId).select(
      'complainantId referenceNumber status __v'
    );
    if (!existingGrievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const update = {
      status,
      resolutionNotes: trimmedResolutionNotes,
      lastUpdatedBy: req.user._id,
      resolvedAt: null,
    };
    if (status === 'pending') {
      update.underReviewAt = null;
      update.departmentAssignedAt = null;
      update.inProgressAt = null;
      update.escalatedAt = null;
    }
    if (status === 'under_review') {
      update.underReviewAt = new Date();
    }
    if (status === 'assigned_to_department') {
      update.departmentAssignedAt = new Date();
    }

    const grievance = await Grievance.findByIdAndUpdate(grievanceId, update, { new: true });
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    await notifyComplainantGrievanceStatusUpdated({
      grievance,
      actor: req.user,
      previousStatus: existingGrievance.status,
      status,
      resolutionNotes: update.resolutionNotes,
    });

    return res.status(200).json({
      success: true,
      message: 'Grievance status updated successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Update grievance status error:', error);
    return res.status(500).json({ success: false, message: 'Error updating grievance status' });
  }
});

router.put('/grievances/:id/overdue-memo', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    const grievanceId = req.params.id;
    const authenticatedAdminId = getAuthenticatedUserId(req.user);

    if (!authenticatedAdminId) {
      return res.status(401).json({ success: false, message: 'Authenticated admin ID is missing' });
    }

    if (!mongoose.Types.ObjectId.isValid(grievanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid grievance ID' });
    }

    const grievance = await Grievance.findById(grievanceId).select(
      'referenceNumber subject status archived createdAt overdueMemoCreated overdueMemoCreatedAt overdueMemoCreatedBy'
    );

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (grievance.overdueMemoCreated) {
      return res.status(409).json({
        success: false,
        message: 'The overdue memo has already been recorded for this grievance.',
      });
    }

    const updatedGrievance = await Grievance.findByIdAndUpdate(
      grievanceId,
      {
        overdueMemoCreated: true,
        overdueMemoCreatedAt: new Date(),
        overdueMemoCreatedBy: authenticatedAdminId,
        lastUpdatedBy: authenticatedAdminId,
      },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email office')
      .populate('complainantId', 'name email complainantType')
      .populate('lastUpdatedBy', 'name email office role')
      .populate('overdueMemoCreatedBy', 'name email office role')
      .populate('rootCauseAnalysis.completedBy', 'name email office role');

    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        user: authenticatedAdminId,
        type: 'update',
        description: `Recorded overdue memo creation for grievance ${grievance.referenceNumber || grievanceId}.`,
        status: 'success',
        details: `Overdue memo marked as created by ${req.user.name || req.user.email || 'administrator'}. Grievance status remained ${grievance.status}.`,
        resource: grievanceId,
      });
    } catch (auditErr) {
      console.error('Failed to create overdue memo audit log:', auditErr);
    }

    const io = req.app.get('io');
    if (io) {
      broadcastSuccessfulUpdate(io, grievanceId, {
        version: updatedGrievance.__v,
        updatedByName: req.user.name,
        changes: { overdueMemoCreated: true },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Memo recorded successfully. The grievance has been moved to the Memo Created list.',
      data: updatedGrievance,
    });
  } catch (error) {
    console.error('Record overdue memo error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error recording overdue memo creation',
    });
  }
});

router.put('/grievances/:id/assign', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    const { assignedTo, version, reassignReason = '' } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'assignedTo user id is required' });
    }

    const grievanceId = req.params.id;

    const assignee = await User.findOne({ _id: assignedTo, role: 'office_handler' }).select('name email office');
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Office handler not found' });
    }

    const existingGrievance = await Grievance.findById(grievanceId).select('__v status assignedTo');
    if (!existingGrievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const isReassignment = existingGrievance.assignedTo && existingGrievance.assignedTo.toString() !== assignedTo;

    const updateData = {
      assignedTo: assignee._id,
      assignedBy: req.user._id,
      handlingLockedBy: null,
      handlingLockedAt: null,
      handlingLockSessionId: null,
      assignedAt: new Date(),
      departmentAssignedAt: new Date(),
      officeReceivedAt: new Date(),
      status: 'assigned_to_department',
      lastUpdatedBy: req.user._id,
    };

    let grievance;

    // Use optimistic locking if version provided
    if (version !== undefined) {
      const result = await updateWithLockAndTransaction(
        Grievance,
        grievanceId,
        async (doc, session) => {
          const updated = await Grievance.findByIdAndUpdate(grievanceId, updateData, {
            new: true,
            session,
            runValidators: true,
          })
            .populate('assignedTo', 'name email office')
            .populate('complainantId', 'name email complainantType')
            .session(session);
          return updated;
        },
        version
      );

      if (!result.success) {
        if (result.conflict) {
          const io = req.app.get('io');
          if (io) {
            notifyConflict(io, req.user._id, grievanceId, {
              currentVersion: result.currentVersion,
              currentState: {
                status: existingGrievance.status,
                assignedTo: existingGrievance.assignedTo,
              },
              updatedBy: existingGrievance.lastUpdatedBy,
              updatedByName: 'Another Administrator',
            });
          }

          return res.status(result.statusCode).json(
            formatConflictResponse(existingGrievance, { assignedTo })
          );
        }
        return res.status(result.statusCode).json({ success: false, message: result.error });
      }

      grievance = result.data;
    } else {
      // Fallback: simple update
      grievance = await Grievance.findByIdAndUpdate(grievanceId, updateData, { new: true })
        .populate('assignedTo', 'name email office')
        .populate('complainantId', 'name email complainantType');

      if (!grievance) {
        return res.status(404).json({ success: false, message: 'Grievance not found' });
      }
    }

    // Log reassignment if applicable
    if (isReassignment) {
      const previousHandler = await User.findById(existingGrievance.assignedTo).select('name email');
      
      await AuditLog.create({
        grievanceId,
        action: 'GRIEVANCE_REASSIGNED',
        performedBy: req.user._id,
        performedByName: req.user.name,
        previousValue: {
          assignedTo: previousHandler?._id,
          assignedToName: previousHandler?.name,
        },
        newValue: {
          assignedTo: assignee._id,
          assignedToName: assignee.name,
        },
        reason: reassignReason || 'Manual reassignment by admin',
        timestamp: new Date(),
        details: {
          action: 'manual_assign',
          reason: reassignReason,
        },
      });

      console.log(`🔄 Grievance ${grievanceId} reassigned from ${previousHandler?.name || 'Unassigned'} to ${assignee.name} by ${req.user.name}${reassignReason ? ` - Reason: ${reassignReason}` : ''}`);
    }

    // Send notifications
    await notifyComplainantGrievanceAssigned({
      grievance,
      actor: req.user,
      assignee,
    });

    await notifyOfficeHandlerAssignment({
      grievance,
      assignee,
      actor: req.user,
    });

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      broadcastSuccessfulUpdate(io, grievanceId, {
        version: grievance.__v,
        updatedByName: req.user.name,
        changes: { assignedTo: assignee.name },
        newStatus: 'assigned_to_department',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Grievance assigned successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Assign grievance error:', error);
    return res.status(500).json({ success: false, message: 'Error assigning grievance' });
  }
});

// PUT: Reassign grievance to different office without automatic handler assignment
router.put('/grievances/:id/reassign-office', ...adminGuard, requirePermission('grievances.edit'), async (req, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmins can route grievances to an office',
      });
    }

    const { newOffice, reassignReason = '', assignToSpecificHandler = null, version } = req.body;
    
    if (!newOffice) {
      return res.status(400).json({ success: false, message: 'New office/destination is required' });
    }

    const grievanceId = req.params.id;
    const beforeState = await Grievance.findById(grievanceId).select('office assignedTo __v status referenceNumber archived');
    
    if (!beforeState) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (beforeState.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Rejected grievances cannot be routed to an office',
      });
    }

    if (beforeState.archived) {
      return res.status(400).json({
        success: false,
        message: 'Archived grievances cannot be routed to an office',
      });
    }

    // Validate new office exists and resolve the selected office category
    const officeCategory = await resolveOfficeCategorySelection(newOffice);

    if (!officeCategory) {
      return res.status(400).json({ success: false, message: 'Invalid office/destination selected' });
    }

    let newHandler = null;

    if (assignToSpecificHandler) {
      const handler = await User.findOne({
        _id: assignToSpecificHandler,
        role: 'office_handler',
        status: 'active',
        isVerified: true,
      }).select('_id name email office');

      if (!handler) {
        return res.status(400).json({ 
          success: false, 
          message: 'Selected handler not found or unauthorized' 
        });
      }
      newHandler = handler;
    }

    const routedAt = new Date();
    const updateData = {
      office: officeCategory.name,
      department: officeCategory.department || null,
      assignedTo: newHandler?._id || null,
      assignedBy: newHandler ? req.user._id : null,
      handlingLockedBy: null,
      handlingLockedAt: null,
      handlingLockSessionId: null,
      assignedAt: newHandler ? routedAt : null,
      departmentAssignedAt: routedAt,
      officeReceivedAt: routedAt,
      status: 'assigned_to_department',
      lastUpdatedBy: req.user._id,
    };

    console.log(`\n📤 [REASSIGN] Preparing update for ${grievanceId}:`);
    console.log(`   Current version from request: ${version}`);
    console.log(`   Update data:`, {
      office: updateData.office,
      assignedTo: updateData.assignedTo ? updateData.assignedTo.toString() : null,
      assignedBy: updateData.assignedBy ? updateData.assignedBy.toString() : null,
      status: updateData.status
    });

    let grievance;

    // Use optimistic locking if version provided
    if (version !== undefined) {
      const result = await updateWithLockAndTransaction(
        Grievance,
        grievanceId,
        async (doc, session) => {
          const updated = await Grievance.findByIdAndUpdate(grievanceId, updateData, {
            new: true,
            session,
            runValidators: true,
          })
            .populate('assignedTo', 'name email office')
            .populate('complainantId', 'name email complainantType')
            .session(session);
          return updated;
        },
        version
      );

      if (!result.success) {
        if (result.conflict) {
          const io = req.app.get('io');
          if (io) {
            notifyConflict(io, req.user._id, grievanceId, {
              currentVersion: result.currentVersion,
              currentState: {
                office: beforeState.office,
                assignedTo: beforeState.assignedTo,
              },
              updatedBy: beforeState.lastUpdatedBy,
              updatedByName: 'Another Administrator',
            });
          }
          return res.status(result.statusCode).json(
            formatConflictResponse(beforeState, { office: newOffice })
          );
        }
        return res.status(result.statusCode).json({ success: false, message: result.error });
      }

      grievance = result.data;
    } else {
      // Fallback: simple update
      grievance = await Grievance.findByIdAndUpdate(grievanceId, updateData, { new: true })
        .populate('assignedTo', 'name email office')
        .populate('complainantId', 'name email complainantType');

      if (!grievance) {
        return res.status(404).json({ success: false, message: 'Grievance not found' });
      }
    }

    // Log the reassignment action
    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        user: req.user._id,
        type: 'update',
        description: newHandler
          ? `Superadmin routed grievance ${beforeState.referenceNumber || grievanceId} to ${officeCategory.name} and assigned ${newHandler.name}.`
          : `Superadmin routed grievance ${beforeState.referenceNumber || grievanceId} to ${officeCategory.name}.`,
        status: 'success',
        details: newHandler
          ? `Grievance moved from ${beforeState.office || 'unassigned'} to ${officeCategory.name} and assigned to ${newHandler.name}`
          : `Grievance moved from ${beforeState.office || 'unassigned'} to ${officeCategory.name} for office review`,
        resource: grievanceId,
      });
    } catch (auditErr) {
      console.error('Failed to create audit log:', auditErr);
    }

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      broadcastSuccessfulUpdate(io, grievanceId, {
        version: grievance.__v,
        updatedByName: req.user.name,
        changes: {
          office: newOffice,
          assignedTo: newHandler?.name || 'Awaiting office review',
        },
        reason: reassignReason,
      });
    }

    if (newHandler) {
      await notifyComplainantGrievanceAssigned({
        grievance,
        actor: req.user,
        assignee: newHandler,
      });

      await notifyOfficeHandlerAssignment({
        grievance,
        assignee: newHandler,
        actor: req.user,
      });
    } else {
      await notifyOfficeHandlersGrievanceRouted({
        grievance,
        officeValues: [
          officeCategory.name,
          officeCategory.id,
          officeCategory.slug,
          officeCategory.college,
        ],
        actor: req.user,
      });

      if (beforeState.status !== 'assigned_to_department') {
        await notifyComplainantGrievanceStatusUpdated({
          grievance,
          actor: req.user,
          previousStatus: beforeState.status,
          status: 'assigned_to_department',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: newHandler
        ? `Grievance reassigned to ${newOffice} and assigned to ${newHandler.name}`
        : `Grievance routed to ${newOffice} for office review`,
      data: sanitizeAnonymousGrievanceForResponse(grievance),
      newHandler: newHandler ? { id: newHandler._id, name: newHandler.name, email: newHandler.email } : null,
    });
  } catch (error) {
    console.error('Reassign office error:', error);
    return res.status(500).json({ success: false, message: 'Error reassigning grievance to new office' });
  }
});

router.delete('/grievances/:id', ...adminGuard, requirePermission('grievances.delete'), async (req, res) => {
  try {
    const { reason = '', version } = req.body || {};
    if (!String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Deletion reason is required' });
    }

    const grievanceId = req.params.id;

    const grievance = await Grievance.findById(grievanceId)
      .populate('complainantId', 'name email contact phone complainantType')
      .select('referenceNumber subject complainantId archived __v');
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    const updateData = {
      archived: true,
      archivedAt: new Date(),
      archivedBy: req.user._id,
      archiveReason: String(reason).trim(),
      archiveType: 'manual',
      lastUpdatedBy: req.user._id,
    };

    let archivedGrievance;

    // Use optimistic locking if version provided
    if (version !== undefined) {
      const result = await updateWithLockAndTransaction(
        Grievance,
        grievanceId,
        async (doc, session) => {
          const updated = await Grievance.findByIdAndUpdate(grievanceId, updateData, {
            new: true,
            session,
            runValidators: true,
          })
            .populate('complainantId', 'name email contact phone complainantType')
            .session(session);
          return updated;
        },
        version
      );

      if (!result.success) {
        if (result.conflict) {
          const io = req.app.get('io');
          if (io) {
            notifyConflict(io, req.user._id, grievanceId, {
              currentVersion: result.currentVersion,
              currentState: {
                archived: grievance.archived,
                status: grievance.status,
              },
              updatedBy: grievance.lastUpdatedBy,
              updatedByName: 'Another Administrator',
            });
          }

          return res.status(result.statusCode).json(
            formatConflictResponse(grievance, { reason })
          );
        }
        return res.status(result.statusCode).json({ success: false, message: result.error });
      }

      archivedGrievance = result.data;
    } else {
      // Fallback: simple update
      archivedGrievance = await Grievance.findByIdAndUpdate(grievanceId, updateData, {
        new: true,
      });

      if (!archivedGrievance) {
        return res.status(404).json({ success: false, message: 'Grievance not found' });
      }
    }

    // Send notification
    await notifyComplainantGrievanceArchived({
      grievance: archivedGrievance,
      actor: req.user,
      reason: String(reason).trim(),
      archiveType: 'manual',
    });

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      broadcastSuccessfulUpdate(io, grievanceId, {
        version: archivedGrievance.__v,
        updatedByName: req.user.name,
        changes: { archived: true, reason },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Grievance archived successfully',
      data: sanitizeAnonymousGrievanceForResponse(archivedGrievance),
    });
  } catch (error) {
    console.error('Delete grievance error:', error);
    return res.status(500).json({ success: false, message: 'Error archiving grievance' });
  }
});

router.get('/grievances/dashboard', ...adminGuard, requirePermission('dashboard.view', 'grievances.view', 'analytics.view'), async (req, res) => {
  try {
    await runMonthlyGrievanceArchiveIfNeeded();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all time statistics
    const [
      totalGrievances,
      pendingReview,
      rejectedCases,
      resolvedThisWeek,
      resolvedAllTime,
      categoryBreakdown,
      monthlyTrend,
      weeklyTrend,
    ] = await Promise.all([
      Grievance.countDocuments({ archived: { $ne: true } }),
      Grievance.countDocuments({ archived: { $ne: true }, status: { $in: ['pending', 'under_review', 'assigned_to_department'] } }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'rejected' }),
      Grievance.countDocuments({ 
        archived: { $ne: true },
        status: 'resolved', 
        resolvedAt: { $gte: weekAgo } 
      }),
      Grievance.countDocuments({ archived: { $ne: true }, status: 'resolved' }),
      Grievance.aggregate([
        { $match: { archived: { $ne: true } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]),
      buildMonthlyTrend(now),
      buildWeeklyTrend(now)
    ]);

    // Calculate resolution rate
    const resolutionRate = totalGrievances > 0 
      ? Number(((resolvedAllTime / totalGrievances) * 100).toFixed(1)) 
      : 0;

    const priorityQueueRows = await Grievance.find({
      archived: { $ne: true },
      status: { $in: OPEN_STATUS },
    })
      .select('referenceNumber subject status priority office createdAt updatedAt')
      .sort({ createdAt: 1, updatedAt: -1 })
      .lean();

    const priorityQueue = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    priorityQueueRows.forEach((item) => {
      const priority = normalizePriority(item.priority);
      priorityQueue[priority].push({
        id: item._id,
        referenceNumber: item.referenceNumber,
        subject: item.subject,
        status: item.status,
        office: item.office,
        priority,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        relativeTime: formatRelativeTime(item.updatedAt || item.createdAt),
      });
    });

    // Get recent activity
    const recentActivity = await Grievance.find({
      archived: { $ne: true },
      updatedAt: { $gte: weekAgo }
    })
    .select('referenceNumber subject status updatedAt')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

    const formattedActivity = recentActivity.map(item => ({
      id: item._id,
      title: `Case ${item.referenceNumber} updated`,
      detail: `Status changed to ${item.status.replace('_', ' ')}`
    }));

    // Format category breakdown with percentages
    const totalCategories = categoryBreakdown.reduce((sum, cat) => sum + cat.count, 0);
    const formattedCategories = categoryBreakdown.map(cat => ({
      name: cat._id || 'Uncategorized',
      count: cat.count,
      percentage: totalCategories > 0 ? Number(((cat.count / totalCategories) * 100).toFixed(1)) : 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalGrievances,
          pendingReview,
          rejectedCases,
          resolvedThisWeek,
          resolutionRate
        },
        trendData: {
          monthly: monthlyTrend,
          weekly: weeklyTrend
        },
        categoryBreakdown: formattedCategories,
        priorityQueue,
        recentActivity: formattedActivity
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching dashboard statistics' });
  }
});

router.get('/grievances/export', ...adminGuard, requirePermission('grievances.export'), async (req, res) => {
  try {
    const {
      format = 'csv',
      search = '',
      status = '',
      priority = '',
      category = '',
      office = '',
      archived = '',
      startDate = '',
      endDate = '',
      month = '',
      grievanceView = '',
      overdueMemoStatus = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    await runMonthlyGrievanceArchiveIfNeeded();
    const requestNow = Date.now();

    const query = buildAdminGrievanceQuery({
      search,
      status,
      priority,
      category,
      office,
      archived,
      grievanceView,
      overdueMemoStatus,
      startDate,
      endDate,
      month,
      now: requestNow,
    });

    const allowedSort = ['createdAt', 'updatedAt', 'priority', 'status', 'referenceNumber', 'archivedAt'];
    const safeSortBy = allowedSort.includes(sortBy) ? sortBy : (archived === 'true' ? 'archivedAt' : 'createdAt');
    const safeSortOrder = sortOrder === 'asc' ? 1 : -1;

    const grievances = await Grievance.find(query)
      .populate('complainantId', 'name email contact phone complainantType')
      .populate('assignedTo', 'name email office')
      .populate('overdueMemoCreatedBy', 'name email role')
      .sort({ [safeSortBy]: safeSortOrder });

    if (format === 'csv') {
      const header = [
        'Reference',
        'Subject',
        'Category',
        'Office',
        'Priority',
        'Status',
        'Complainant',
        'Email',
        'Assigned To',
        'Overdue Memo Created',
        'Overdue Memo Created At',
        'Overdue Memo Created By',
        'Created At',
      ].join(',');

      const rows = grievances.map((grievance) => {
        const g = sanitizeAnonymousGrievanceForResponse(grievance);
        return [
          escCSV(g.referenceNumber),
          escCSV(g.subject),
          escCSV(g.category),
          escCSV(g.office),
          escCSV(g.priority),
          escCSV(g.status),
          escCSV(g.complainantName),
          escCSV(g.complainantEmail),
          escCSV(g.assignedTo?.name || ''),
          escCSV(g.overdueMemoCreated ? 'Yes' : 'No'),
          escCSV(g.overdueMemoCreatedAt?.toISOString?.() || ''),
          escCSV(g.overdueMemoCreatedBy?.name || ''),
          escCSV(g.createdAt?.toISOString?.() || g.createdAt),
        ].join(',');
      });

      const csv = [header, ...rows].join('\n');
      const normalizedMonth = /^\d{4}-\d{2}$/.test(String(month || '')) ? `-${month}` : '';
      const rangeSuffix = !normalizedMonth && (startDate || endDate)
        ? `-${startDate || 'start'}-to-${endDate || 'end'}`
        : '';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=grievances${normalizedMonth || rangeSuffix}.csv`);
      return res.send(csv);
    }

    return res.status(200).json({ success: true, data: sanitizeAnonymousGrievancesForResponse(grievances) });
  } catch (error) {
    console.error('Export grievances error:', error);
    return res.status(500).json({ success: false, message: 'Error exporting grievances' });
  }
});

router.get('/grievances/:id', ...adminGuard, requirePermission('grievances.view'), async (req, res) => {
  try {
    const grievance = await Grievance.findById(req.params.id)
      .populate('assignedTo', 'name email office')
      .populate('complainantId', 'name email contact phone complainantType')
      .populate('lastUpdatedBy', 'name email office role')
      .populate('overdueMemoCreatedBy', 'name email office role')
      .populate('rootCauseAnalysis.completedBy', 'name email office role');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Get grievance details error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance details' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Grievance = require('../models/Grievance');
const OfficeCategory = require('../models/OfficeCategory');
const { authenticateToken, checkRole, requirePermission } = require('../middleware/auth');
const {
  notifyAdminsGrievanceStatusUpdated,
  notifyComplainantGrievanceStatusUpdated,
} = require('../services/notificationService');
const {
  getOfficeHandlers,
  verifyOfficeHandler,
  rejectOfficeHandler,
  updateOfficeHandler,
  deleteOfficeHandler,
  getOfficeCategories,
  createOfficeCategory,
  updateOfficeCategory,
  deleteOfficeCategory,
} = require('../controllers/officeController');
const { runMonthlyGrievanceArchiveIfNeeded } = require('../utils/grievanceMonthlyArchive');
const {
  sanitizeAnonymousGrievanceForResponse,
  sanitizeAnonymousGrievancesForResponse,
} = require('../utils/anonymousSanitizer');

const adminOfficeGuard = checkRole('admin', 'superadmin');
const OPEN_STATUS = ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'escalated'];
const OFFICE_VISIBLE_STATUS = ['assigned_to_department', 'in_progress', 'resolved', 'escalated'];
const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSpace = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const uniqueStrings = (values = []) => [...new Set(values.map((value) => normalizeSpace(value)).filter(Boolean))];
const noDepartmentMatch = {
  $or: [
    { department: null },
    { department: '' },
    { department: { $exists: false } },
  ],
};
const sanitizeFishboneEntries = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 20);
const sanitizeAttachments = (attachments = []) =>
  (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => attachment && attachment.url)
    .map((attachment) => ({
      url: String(attachment.url || '').trim(),
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
    }))
    .slice(0, 10);

const resolveOfficeScope = async (user) => {
  const rawOffice = String(user?.office || '').trim();
  if (!rawOffice) {
    return { directValues: [] };
  }

  const officeCategory = await OfficeCategory.findOne({
    $or: [
      { slug: rawOffice },
      { name: rawOffice },
      { name: { $regex: `^${escapeRegex(rawOffice)}$`, $options: 'i' } },
    ],
    status: 'active',
  }).select('name slug college department');

  const isCollegeLevel = officeCategory && !normalizeSpace(officeCategory.department);

  const directValues = [...new Set([
    rawOffice,
    officeCategory?.slug,
    officeCategory?.name,
    isCollegeLevel ? officeCategory?.college : '',
  ].filter(Boolean))];

  return { directValues, officeCategory };
};

const buildDepartmentAliases = (department = '') => {
  const rawDepartment = normalizeSpace(department);
  if (!rawDepartment) {
    return [];
  }

  const baseDepartment = normalizeSpace(
    rawDepartment
      .replace(/\bdepartment\b/gi, '')
      .replace(/\bdept\.?\b/gi, '')
  );

  return uniqueStrings([
    rawDepartment,
    baseDepartment,
    baseDepartment ? `${baseDepartment} Department` : '',
    baseDepartment ? `${baseDepartment} Dept` : '',
    baseDepartment ? `${baseDepartment} Dept.` : '',
  ]);
};

const buildOfficeScopeConditions = ({
  rawOffice = '',
  directValues = [],
  officeCategory = null,
  userId = null,
}) => {
  const conditions = [];

  if (userId) {
    conditions.push({ assignedTo: userId });
  }

  const categoryName = normalizeSpace(officeCategory?.name);
  const collegeName = normalizeSpace(officeCategory?.college);
  const departmentName = normalizeSpace(officeCategory?.department);
  const collegeAcronym = collegeName.match(/\(([^)]+)\)/)?.[1]?.trim() || '';
  const departmentAliases = buildDepartmentAliases(departmentName);
  const isCollegeLevel = officeCategory && collegeName && !departmentName;

  if (isCollegeLevel) {
    const collegeValues = uniqueStrings([
      categoryName,
      collegeName,
      officeCategory?.slug,
      rawOffice,
    ]);

    if (collegeValues.length > 0) {
      conditions.push({
        $and: [
          { office: { $in: collegeValues } },
          noDepartmentMatch,
        ],
      });
      conditions.push({
        $and: [
          {
            $or: collegeValues.map((value) => ({
              office: { $regex: `^${escapeRegex(value)}$`, $options: 'i' },
            })),
          },
          noDepartmentMatch,
        ],
      });
    }

    return conditions;
  }

  if (directValues.length > 0) {
    conditions.push({ office: { $in: directValues } });
    conditions.push({
      $or: directValues.map((value) => ({
        office: { $regex: `^${escapeRegex(value)}$`, $options: 'i' },
      })),
    });
  }

  if (categoryName) {
    conditions.push({
      office: { $regex: `^${escapeRegex(categoryName)}$`, $options: 'i' },
    });
  }

  if (collegeName && departmentAliases.length > 0) {
    conditions.push({
      office: { $regex: `^${escapeRegex(collegeName)}(?:\\s+${escapeRegex(departmentName)})?$`, $options: 'i' },
      $or: departmentAliases.map((alias) => ({
        department: { $regex: `^${escapeRegex(alias)}$`, $options: 'i' },
      })),
    });
  }

  if (collegeAcronym && departmentAliases.length > 0) {
    conditions.push({
      office: { $regex: `\\b${escapeRegex(collegeAcronym)}\\b`, $options: 'i' },
      $or: departmentAliases.map((alias) => ({
        department: { $regex: `^${escapeRegex(alias)}$`, $options: 'i' },
      })),
    });

    const compactDepartment = normalizeSpace(
      departmentAliases[0]
        .replace(/\bdepartment\b/gi, '')
        .replace(/\bdept\.?\b/gi, '')
    );

    if (compactDepartment) {
      conditions.push({
        office: {
          $regex: `^${escapeRegex(collegeAcronym)}\\s*-\\s*${escapeRegex(compactDepartment)}(?:\\s*(?:Dept\\.?|Department))?$`,
          $options: 'i',
        },
      });
    }
  }

  if (rawOffice && departmentAliases.length > 0) {
    conditions.push({
      office: { $regex: `\\b${escapeRegex(rawOffice)}\\b`, $options: 'i' },
      $or: departmentAliases.map((alias) => ({
        department: { $regex: `^${escapeRegex(alias)}$`, $options: 'i' },
      })),
    });
  }

  return conditions;
};

const buildOfficeMatch = async (user, { archived = false } = {}) => {
  const includeArchived = archived === true || archived === 'true';

  if (user.role !== 'office_handler') {
    return includeArchived ? { archived: true } : { archived: { $ne: true } };
  }

  const rawOffice = String(user?.office || '').trim();
  const { directValues, officeCategory } = await resolveOfficeScope(user);
  const officeConditions = buildOfficeScopeConditions({
    rawOffice,
    directValues,
    officeCategory,
    userId: user._id,
  });

  if (includeArchived) {
    return {
      archived: true,
      $or: officeConditions,
    };
  }

  return {
    archived: { $ne: true },
    status: { $in: OFFICE_VISIBLE_STATUS },
    $or: officeConditions,
  };
};

const startOfUtcWeek = (dateInput) => {
  const date = new Date(dateInput);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
};

const startOfUtcDay = (dateInput) => {
  const date = new Date(dateInput);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
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
  return PRIORITY_ORDER.includes(normalized) ? normalized : 'medium';
};

const isSameUserId = (left, right) => String(left || '') === String(right || '');

const formatHandlerLockMessage = (grievance, fallback = 'another office handler') => {
  const handlerName = grievance?.handlingLockedBy?.name || fallback;
  return `This grievance is currently handled by ${handlerName}. You can review it, but actions are disabled.`;
};

const buildMonthlyTrend = async (match, now = new Date()) => {
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1, 0, 0, 0, 0));
  const resolutionHourDivisor = 1000 * 60 * 60;

  const [filedRows, resolvedRows, openRows] = await Promise.all([
    Grievance.aggregate([
      {
        $match: {
          ...Object.fromEntries(Object.entries(match).filter(([key]) => key !== 'archived')),
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
    Grievance.aggregate([
      {
        $match: {
          ...Object.fromEntries(Object.entries(match).filter(([key]) => key !== 'archived')),
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
          ...match,
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
  const openMap = new Map(openRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));

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
      open: openMap.get(key) || 0,
    });
  }

  return trend;
};

const getAverageResolutionTimeHours = async (match) => {
  const [result] = await Grievance.aggregate([
    {
      $match: {
        ...match,
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

const buildResolutionTrend = async (match, now = new Date()) => {
  const currentWeekStart = startOfUtcWeek(now);
  const firstWeekStart = new Date(currentWeekStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - 7 * 7);

  const rows = await Grievance.aggregate([
    {
      $match: {
        ...match,
        status: 'resolved',
        resolvedAt: { $gte: firstWeekStart, $ne: null },
      },
    },
    {
      $project: {
        resolvedAt: 1,
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
        },
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
        average: { $avg: '$resolutionHours' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const trendMap = new Map(
    rows.map((row) => [new Date(row._id).toISOString(), Number(row.average.toFixed(1))])
  );

  const trend = [];
  for (let i = 0; i < 8; i += 1) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCDate(firstWeekStart.getUTCDate() + i * 7);
    const key = weekStart.toISOString();

    trend.push({
      label: formatWeekLabel(weekStart),
      average: trendMap.get(key) || 0,
    });
  }

  return trend;
};

// All routes require authentication
router.use(authenticateToken);
router.use(async (req, res, next) => {
  try {
    await runMonthlyGrievanceArchiveIfNeeded();
    next();
  } catch (error) {
    console.error('Monthly grievance archive error:', error);
    res.status(500).json({ success: false, message: 'Error preparing grievance records' });
  }
});

// Office handler management
router.get('/handlers', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), getOfficeHandlers);
router.put('/handlers/:userId/verify', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), verifyOfficeHandler);
router.put('/handlers/:userId', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), updateOfficeHandler);
router.post('/handlers/:userId/reject', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), rejectOfficeHandler);
router.delete('/handlers/:userId', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), deleteOfficeHandler);

router.get('/grievances/assigned', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = '',
      archiveType = '',
      archived = '',
      search = '',
    } = req.query;
    const includeArchived = String(archived).toLowerCase() === 'true';

    const queryParts = [await buildOfficeMatch(req.user, { archived: includeArchived })];

    if (includeArchived && archiveType) {
      queryParts.push({ archiveType });
    }

    if (!includeArchived && status) {
      queryParts.push({ status });
    }

    if (search) {
      queryParts.push({
        $or: [
          { referenceNumber: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { complainantName: { $regex: search, $options: 'i' } },
          { complainantEmail: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const query = queryParts.length === 1 ? queryParts[0] : { $and: queryParts };

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;

    const populateOptions = [
      { path: 'complainantId', select: 'name email' },
      { path: 'assignedTo', select: 'name email office' },
      { path: 'handlingLockedBy', select: 'name email office role' },
      { path: 'rootCauseAnalysis.completedBy', select: 'name email office role' },
    ];

    const [grievances, total] = includeArchived
      ? await Promise.all([
          Grievance.aggregate([
            { $match: query },
            { $sort: { archivedAt: -1, updatedAt: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: parsedLimit },
          ]).then((rows) => Grievance.populate(rows, populateOptions)),
          Grievance.countDocuments(query),
        ])
      : await Promise.all([
          Grievance.aggregate([
            { $match: query },
            {
              $addFields: {
                workflowRank: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$status', 'assigned_to_department'] }, then: 0 },
                      { case: { $eq: ['$status', 'in_progress'] }, then: 1 },
                      { case: { $eq: ['$status', 'escalated'] }, then: 2 },
                      { case: { $eq: ['$status', 'resolved'] }, then: 3 },
                    ],
                    default: 4,
                  },
                },
                priorityRank: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$priority', 'critical'] }, then: 0 },
                      { case: { $eq: ['$priority', 'high'] }, then: 1 },
                      { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                      { case: { $eq: ['$priority', 'low'] }, then: 3 },
                    ],
                    default: 4,
                  },
                },
              },
            },
            // Order the queue by workflow stage first, then urgency inside each stage.
            { $sort: { workflowRank: 1, priorityRank: 1, updatedAt: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: parsedLimit },
          ]).then((rows) => Grievance.populate(rows, populateOptions)),
          Grievance.countDocuments(query),
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
    });
  } catch (error) {
    console.error('Get assigned grievances error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching assigned grievances' });
  }
});

router.get('/grievances/stats', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const includeArchived = String(req.query.archived || '').toLowerCase() === 'true';
    const match = await buildOfficeMatch(req.user, { archived: includeArchived });

    if (includeArchived) {
      const [total, monthlyReset, rejected, deleted] = await Promise.all([
        Grievance.countDocuments(match),
        Grievance.countDocuments({ ...match, archiveType: 'monthly_reset' }),
        Grievance.countDocuments({ ...match, archiveType: 'rejected' }),
        Grievance.countDocuments({ ...match, archiveType: 'deleted' }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          total,
          monthlyReset,
          rejected,
          deleted,
        },
      });
    }

    const [total, pending, inProgress, resolved, escalated] = await Promise.all([
      Grievance.countDocuments(match),
      Grievance.countDocuments({ ...match, status: 'assigned_to_department' }),
      Grievance.countDocuments({ ...match, status: 'in_progress' }),
      Grievance.countDocuments({ ...match, status: 'resolved' }),
      Grievance.countDocuments({ ...match, status: 'escalated' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        resolved,
        escalated,
      },
    });
  } catch (error) {
    console.error('Get office grievance stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance statistics' });
  }
});

router.get('/grievances/dashboard', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const match = await buildOfficeMatch(req.user);
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const weekStart = startOfUtcWeek(now);

    const [
      total,
      pending,
      inProgress,
      escalated,
      resolvedToday,
      resolvedThisWeek,
      resolvedTotal,
      avgResolutionHours,
      recentGrievances,
      priorityQueueRows,
    ] = await Promise.all([
      Grievance.countDocuments(match),
      Grievance.countDocuments({ ...match, status: 'assigned_to_department' }),
      Grievance.countDocuments({ ...match, status: 'in_progress' }),
      Grievance.countDocuments({ ...match, status: 'escalated' }),
      Grievance.countDocuments({ ...match, status: 'resolved', resolvedAt: { $gte: todayStart } }),
      Grievance.countDocuments({ ...match, status: 'resolved', resolvedAt: { $gte: weekStart } }),
      Grievance.countDocuments({ ...match, status: 'resolved' }),
      getAverageResolutionTimeHours(match),
      Grievance.find({ ...match, status: { $in: OFFICE_VISIBLE_STATUS } })
        .select('referenceNumber subject status priority createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      Grievance.find({ ...match, status: { $in: ['assigned_to_department', 'in_progress', 'escalated'] } })
        .select('referenceNumber subject status priority createdAt updatedAt')
        .sort({ createdAt: -1, updatedAt: -1 })
        .lean(),
    ]);

    const priorityQueue = PRIORITY_ORDER.reduce((groups, priority) => {
      groups[priority] = [];
      return groups;
    }, {});

    priorityQueueRows.forEach((item) => {
      const priority = normalizePriority(item.priority);
      priorityQueue[priority].push({
        id: item._id,
        referenceNumber: item.referenceNumber,
        subject: item.subject,
        status: item.status,
        priority,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        relativeTime: formatRelativeTime(item.createdAt || item.updatedAt),
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total,
          pending,
          inProgress,
          escalated,
          resolvedToday,
          resolvedThisWeek,
          resolvedTotal,
          avgResolutionHours,
        },
        recentGrievances: recentGrievances.map((item) => ({
          id: item._id,
          referenceNumber: item.referenceNumber,
          subject: item.subject,
          status: item.status,
          priority: item.priority,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt,
          relativeTime: formatRelativeTime(item.updatedAt || item.createdAt),
        })),
        priorityQueue,
      },
    });
  } catch (error) {
    console.error('Get office dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching office dashboard data' });
  }
});

router.get('/grievances/analytics', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const match = await buildOfficeMatch(req.user);
    const [totalCases, pending, inProgress, resolved, escalated, avgResolutionHours, monthlyTrend] = await Promise.all([
      Grievance.countDocuments(match),
      Grievance.countDocuments({ ...match, status: 'assigned_to_department' }),
      Grievance.countDocuments({ ...match, status: 'in_progress' }),
      Grievance.countDocuments({ ...match, status: 'resolved' }),
      Grievance.countDocuments({ ...match, status: 'escalated' }),
      getAverageResolutionTimeHours(match),
      buildMonthlyTrend(match),
    ]);

    const resolutionRate = totalCases > 0 ? Number(((resolved / totalCases) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCases,
          pending,
          inProgress,
          resolved,
          escalated,
          avgResolutionHours,
          resolutionRate,
        },
        monthlyTrend,
      },
    });
  } catch (error) {
    console.error('Get office analytics error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching office analytics data' });
  }
});

router.get('/grievances/resolution-stats', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const match = await buildOfficeMatch(req.user);
    const resolvedRows = await Grievance.aggregate([
      {
        $match: {
          ...match,
          status: 'resolved',
          resolvedAt: { $ne: null },
        },
      },
      {
        $project: {
          category: { $ifNull: ['$category', 'Uncategorized'] },
          resolutionHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $sort: { resolutionHours: 1 } },
    ]);

    const categoryRows = await Grievance.aggregate([
      {
        $match: {
          ...match,
          status: 'resolved',
          resolvedAt: { $ne: null },
        },
      },
      {
        $project: {
          category: { $ifNull: ['$category', 'Uncategorized'] },
          resolutionHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      {
        $group: {
          _id: '$category',
          resolved: { $sum: 1 },
          avgTime: { $avg: '$resolutionHours' },
        },
      },
      { $sort: { resolved: -1, avgTime: 1 } },
      { $limit: 6 },
    ]);

    const weeklyTrend = await buildResolutionTrend(match);
    const totalResolved = resolvedRows.length;
    const values = resolvedRows.map((row) => row.resolutionHours);
    const avgResolutionTime = totalResolved
      ? Number((values.reduce((sum, value) => sum + value, 0) / totalResolved).toFixed(1))
      : 0;
    const medianTime = totalResolved
      ? Number(
          (
            totalResolved % 2 === 0
              ? (values[(totalResolved / 2) - 1] + values[totalResolved / 2]) / 2
              : values[Math.floor(totalResolved / 2)]
          ).toFixed(1)
        )
      : 0;
    const minTime = totalResolved ? Number(values[0].toFixed(1)) : 0;
    const maxTime = totalResolved ? Number(values[totalResolved - 1].toFixed(1)) : 0;
    const withinSLA = values.filter((value) => value <= 72).length;
    const slaCompliance = totalResolved ? Number(((withinSLA / totalResolved) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          avgResolutionTime,
          medianTime,
          maxTime,
          minTime,
          totalResolved,
          withinSLA,
          slaCompliance,
        },
        weeklyTrend,
        categoryBreakdown: categoryRows.map((item) => ({
          category: item._id || 'Uncategorized',
          avgTime: Number(item.avgTime.toFixed(1)),
          resolved: item.resolved,
        })),
      },
    });
  } catch (error) {
    console.error('Get office resolution stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching office resolution statistics' });
  }
});

router.get('/grievances/:id', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const query = { ...(await buildOfficeMatch(req.user)), _id: req.params.id };
    const grievance = await Grievance.findOne(query)
      .populate('complainantId', 'name email')
      .populate('assignedTo', 'name email office')
      .populate('handlingLockedBy', 'name email office role')
      .populate('rootCauseAnalysis.completedBy', 'name email office role');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Assigned grievance not found' });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Get assigned grievance detail error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching assigned grievance detail' });
  }
});

router.put('/grievances/:id/status', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { status, resolutionNotes = '' } = req.body;
    const clientSessionId = String(req.headers['x-client-session-id'] || '').trim();
    const allowedStatus = ['in_progress', 'escalated'];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const query = { ...(await buildOfficeMatch(req.user)), _id: req.params.id };

    const update = {
      status,
      resolutionNotes: String(resolutionNotes || '').trim(),
      lastUpdatedBy: req.user._id,
    };

    if (status === 'in_progress') {
      update.inProgressAt = new Date();
    }

    if (status === 'escalated') {
      update.escalatedAt = new Date();
    }

    const existingGrievance = await Grievance.findOne(query)
      .select('complainantId referenceNumber status handlingLockedBy handlingLockedAt handlingLockSessionId')
      .populate('handlingLockedBy', 'name email office role');
    if (!existingGrievance) {
      return res.status(404).json({ success: false, message: 'Assigned grievance not found' });
    }

    let actionQuery = query;

    if (req.user.role === 'office_handler') {
      const isUnownedInProgressClaim =
        status === 'in_progress' &&
        existingGrievance.status === 'in_progress' &&
        !existingGrievance.handlingLockedBy;
      const isLockedByAnother =
        existingGrievance.handlingLockedBy &&
        (
          !isSameUserId(existingGrievance.handlingLockedBy._id, req.user._id) ||
          (existingGrievance.handlingLockSessionId && clientSessionId && existingGrievance.handlingLockSessionId !== clientSessionId)
        );

      if (isLockedByAnother) {
        return res.status(409).json({
          success: false,
          message: formatHandlerLockMessage(existingGrievance),
          data: sanitizeAnonymousGrievanceForResponse(existingGrievance),
        });
      }

      if (status === 'in_progress') {
        const lockGuard = isUnownedInProgressClaim
          ? {
              $or: [
                { handlingLockedBy: null },
                { handlingLockedBy: { $exists: false } },
              ],
            }
          : {
              $or: [
                { handlingLockedBy: null },
                { handlingLockedBy: req.user._id, ...(clientSessionId ? { handlingLockSessionId: clientSessionId } : {}) },
              ],
            };
        actionQuery = {
          $and: [
            query,
            lockGuard,
          ],
        };
        update.handlingLockedBy = req.user._id;
        update.handlingLockedAt = existingGrievance.handlingLockedAt || new Date();
        update.handlingLockSessionId = clientSessionId || existingGrievance.handlingLockSessionId || null;
      } else if (!existingGrievance.handlingLockedBy) {
        return res.status(409).json({
          success: false,
          message: 'Mark this grievance as In Progress first to claim it before taking action.',
          data: sanitizeAnonymousGrievanceForResponse(existingGrievance),
        });
      }
    }

    let grievance = await Grievance.findOneAndUpdate(actionQuery, update, { new: true })
      .populate('complainantId', 'name email')
      .populate('assignedTo', 'name email office');

    if (!grievance && req.user.role === 'office_handler' && status === 'in_progress') {
      const lockedGrievance = await Grievance.findOne(query)
        .populate('complainantId', 'name email')
        .populate('assignedTo', 'name email office')
        .populate('handlingLockedBy', 'name email office role');

      const lockedByAnotherSession =
        lockedGrievance?.handlingLockSessionId &&
        clientSessionId &&
        lockedGrievance.handlingLockSessionId !== clientSessionId;

      if (
        lockedGrievance?.handlingLockedBy &&
        (!isSameUserId(lockedGrievance.handlingLockedBy._id, req.user._id) || lockedByAnotherSession)
      ) {
        return res.status(409).json({
          success: false,
          message: formatHandlerLockMessage(lockedGrievance),
          data: sanitizeAnonymousGrievanceForResponse(lockedGrievance),
        });
      }
    }

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Assigned grievance not found' });
    }

    await grievance.populate('handlingLockedBy', 'name email office role');

    await notifyComplainantGrievanceStatusUpdated({
      grievance,
      actor: req.user,
      previousStatus: existingGrievance.status,
      status,
      resolutionNotes: update.resolutionNotes,
    });

    return res.status(200).json({
      success: true,
      message: 'Grievance updated successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Update assigned grievance error:', error);
    return res.status(500).json({ success: false, message: 'Error updating grievance' });
  }
});

router.post('/grievances/:id/rca', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const {
      problemSummary,
      rootCauseCategory,
      rootCauseDescription,
      actionTaken,
      preventiveAction,
      rcaStatus,
      fishbone = {},
      resolutionEvidence = [],
    } = req.body;
    const clientSessionId = String(req.headers['x-client-session-id'] || '').trim();

    if (!problemSummary || !rootCauseCategory || !rootCauseDescription || !actionTaken || !preventiveAction) {
      return res.status(400).json({
        success: false,
        message: 'All RCA fields are required: problemSummary, rootCauseCategory, rootCauseDescription, actionTaken, preventiveAction',
      });
    }

    const query = { ...(await buildOfficeMatch(req.user)), _id: req.params.id };

    const grievance = await Grievance.findOne(query).populate('handlingLockedBy', 'name email office role');
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (req.user.role === 'office_handler') {
      const lockedByAnotherSession =
        grievance.handlingLockSessionId &&
        clientSessionId &&
        grievance.handlingLockSessionId !== clientSessionId;

      if (!grievance.handlingLockedBy) {
        return res.status(409).json({
          success: false,
          message: 'Mark this grievance as In Progress first to claim it before editing the RCA.',
          data: sanitizeAnonymousGrievanceForResponse(grievance),
        });
      }

      if (!isSameUserId(grievance.handlingLockedBy?._id, req.user._id) || lockedByAnotherSession) {
        return res.status(409).json({
          success: false,
          message: formatHandlerLockMessage(grievance),
          data: sanitizeAnonymousGrievanceForResponse(grievance),
        });
      }
    }

    if (!grievance.rootCauseAnalysis) {
      grievance.rootCauseAnalysis = {};
    }

    grievance.rootCauseAnalysis.problemSummary = String(problemSummary || '').trim();
    grievance.rootCauseAnalysis.rootCauseCategory = rootCauseCategory;
    grievance.rootCauseAnalysis.rootCauseDescription = String(rootCauseDescription || '').trim();
    grievance.rootCauseAnalysis.actionTaken = String(actionTaken || '').trim();
    grievance.rootCauseAnalysis.preventiveAction = String(preventiveAction || '').trim();
    grievance.rootCauseAnalysis.fishbone = {
      people: sanitizeFishboneEntries(fishbone.people),
      process: sanitizeFishboneEntries(fishbone.process),
      policy: sanitizeFishboneEntries(fishbone.policy),
      systemTechnology: sanitizeFishboneEntries(fishbone.systemTechnology),
      environment: sanitizeFishboneEntries(fishbone.environment),
      evidence: sanitizeFishboneEntries(fishbone.evidence),
    };
    grievance.rootCauseAnalysis.resolutionEvidence = sanitizeAttachments(resolutionEvidence);
    grievance.rootCauseAnalysis.rcaStatus =
      rcaStatus === 'resolved'
        ? 'resolved'
        : 'in_progress';
    grievance.rootCauseAnalysis.responsibleOffice =
      grievance.rootCauseAnalysis.responsibleOffice || req.user.office || grievance.office;

    await grievance.save();
    await grievance.populate('complainantId', 'name email');
    await grievance.populate('assignedTo', 'name email office role');
    await grievance.populate('handlingLockedBy', 'name email office role');
    await grievance.populate('rootCauseAnalysis.completedBy', 'name email office role');

    return res.status(200).json({
      success: true,
      message: 'Root Cause Analysis saved successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Save RCA error:', error);
    return res.status(500).json({ success: false, message: 'Error saving RCA' });
  }
});

router.put('/grievances/:id/rca/resolve', checkRole('office_handler', 'admin', 'superadmin'), async (req, res) => {
  try {
    const {
      problemSummary,
      rootCauseCategory,
      rootCauseDescription,
      actionTaken,
      preventiveAction,
      resolutionNotes = '',
      fishbone = {},
      resolutionEvidence = [],
    } = req.body;
    const clientSessionId = String(req.headers['x-client-session-id'] || '').trim();

    const trimmedResolutionNotes = String(resolutionNotes || '').trim();

    if (!problemSummary || !rootCauseCategory || !rootCauseDescription || !actionTaken || !preventiveAction) {
      return res.status(400).json({
        success: false,
        message: 'All RCA fields are required before resolving the grievance.',
      });
    }

    const query = { ...(await buildOfficeMatch(req.user)), _id: req.params.id };

    const grievance = await Grievance.findOne(query).populate('handlingLockedBy', 'name email office role');
    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (req.user.role === 'office_handler') {
      const lockedByAnotherSession =
        grievance.handlingLockSessionId &&
        clientSessionId &&
        grievance.handlingLockSessionId !== clientSessionId;

      if (!grievance.handlingLockedBy) {
        return res.status(409).json({
          success: false,
          message: 'Mark this grievance as In Progress first to claim it before resolving it.',
          data: sanitizeAnonymousGrievanceForResponse(grievance),
        });
      }

      if (!isSameUserId(grievance.handlingLockedBy?._id, req.user._id) || lockedByAnotherSession) {
        return res.status(409).json({
          success: false,
          message: formatHandlerLockMessage(grievance),
          data: sanitizeAnonymousGrievanceForResponse(grievance),
        });
      }
    }

    if (!grievance.rootCauseAnalysis) {
      grievance.rootCauseAnalysis = {};
    }

    const resolutionTimestamp = new Date();
    grievance.rootCauseAnalysis.problemSummary = String(problemSummary || '').trim();
    grievance.rootCauseAnalysis.rootCauseCategory = rootCauseCategory;
    grievance.rootCauseAnalysis.rootCauseDescription = String(rootCauseDescription || '').trim();
    grievance.rootCauseAnalysis.actionTaken = String(actionTaken || '').trim();
    grievance.rootCauseAnalysis.preventiveAction = String(preventiveAction || '').trim();
    grievance.rootCauseAnalysis.fishbone = {
      people: sanitizeFishboneEntries(fishbone.people),
      process: sanitizeFishboneEntries(fishbone.process),
      policy: sanitizeFishboneEntries(fishbone.policy),
      systemTechnology: sanitizeFishboneEntries(fishbone.systemTechnology),
      environment: sanitizeFishboneEntries(fishbone.environment),
      evidence: sanitizeFishboneEntries(fishbone.evidence),
    };
    grievance.rootCauseAnalysis.resolutionEvidence = sanitizeAttachments(resolutionEvidence);
    grievance.rootCauseAnalysis.rcaStatus = 'resolved';
    grievance.rootCauseAnalysis.completedBy = req.user._id;
    grievance.rootCauseAnalysis.completedAt = resolutionTimestamp;
    grievance.rootCauseAnalysis.resolutionDate = resolutionTimestamp;
    grievance.rootCauseAnalysis.responsibleOffice = req.user.office || grievance.office;

    grievance.status = 'resolved';
    grievance.resolutionNotes = trimmedResolutionNotes;
    grievance.resolvedAt = resolutionTimestamp;
    grievance.inProgressAt = grievance.inProgressAt || resolutionTimestamp;
    grievance.lastUpdatedBy = req.user._id;

    const existingGrievance = await Grievance.findOne(query).select('complainantId referenceNumber status');
    await grievance.save();

    await grievance.populate('complainantId', 'name email');
    await grievance.populate('assignedTo', 'name email office role');
    await grievance.populate('handlingLockedBy', 'name email office role');
    await grievance.populate('rootCauseAnalysis.completedBy', 'name email office role');

    await notifyComplainantGrievanceStatusUpdated({
      grievance,
      actor: req.user,
      previousStatus: existingGrievance?.status || 'in_progress',
      status: 'resolved',
      resolutionNotes: trimmedResolutionNotes,
    });

    await notifyAdminsGrievanceStatusUpdated({
      grievance,
      actor: req.user,
      status: 'resolved',
      resolutionNotes: trimmedResolutionNotes,
    });

    return res.status(200).json({
      success: true,
      message: 'Root Cause Analysis resolved successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance),
    });
  } catch (error) {
    console.error('Resolve RCA error:', error);
    return res.status(500).json({ success: false, message: 'Error resolving RCA' });
  }
});

// Office category management
router.get('/categories', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), getOfficeCategories);
router.post('/categories', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), createOfficeCategory);
router.put('/categories/:categoryId', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), updateOfficeCategory);
router.delete('/categories/:categoryId', authenticateToken, adminOfficeGuard, requirePermission('offices.manage'), deleteOfficeCategory);

module.exports = router;

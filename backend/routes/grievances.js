const express = require('express');
const router = express.Router();
const Grievance = require('../models/Grievance');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { analyzeComplaint } = require('../services/aiPipelineClient');
const {
  notifyAdminsGrievanceSubmitted,
  notifyComplainantGrievanceSubmitted,
  notifySuperadminsCriticalGrievanceDetected,
} = require('../services/notificationService');
const { getSystemSettingsSnapshot } = require('../utils/systemSettings');
const {
  OPEN_GRIEVANCE_STATUSES,
  getGrievanceOverdueDeadline,
  buildOpenGrievanceQuery,
} = require('../utils/grievanceSla');
const {
  getComplainantIdentity,
  sanitizeAnonymousText,
  sanitizeAnonymousTranscript,
  sanitizeAnonymousGrievanceForResponse,
  sanitizeAnonymousGrievancesForResponse,
} = require('../utils/anonymousSanitizer');

const ALLOWED_PRIORITY = ['low', 'medium', 'high', 'critical'];
const DEFAULT_MAX_ACTIVE_GRIEVANCES = 5;
const ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE =
  'You currently have 5 active grievances. Please wait for one of your existing grievances to be resolved or until an unresolved grievance exceeds the 72-hour processing period before submitting another concern.';

const extractObjectIdString = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value._id) {
    return String(value._id);
  }

  return String(value);
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

const sanitizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .filter((attachment) => attachment && attachment.url)
    .map((attachment) => ({
      url: String(attachment.url).trim(),
      publicId: attachment.publicId ? String(attachment.publicId).trim() : null,
      fileName: attachment.originalName ? String(attachment.originalName).trim() : null,
      fileType: attachment.format ? String(attachment.format).trim() : null,
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

const mapPriorityFromAi = (aiAnalysis) => {
  const label = aiAnalysis?.urgency?.label;
  return ALLOWED_PRIORITY.includes(label) ? label : 'medium';
};

const sanitizeIncidentDate = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 80 || /[{}\[\]]/.test(normalized)) {
    return '';
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString('en-US');
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const analyzeComplaintWithRetry = async (text, attempts = 2) => {
  let lastError = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await analyzeComplaint(text);
    } catch (error) {
      lastError = error;

      if (index < attempts - 1) {
        await delay(1500);
      }
    }
  }

  throw lastError || new Error('AI analysis failed');
};

const loadRealtimeGrievance = async (grievanceId) =>
  Grievance.findById(grievanceId)
    .populate('assignedTo', 'name email office')
    .populate('complainantId', 'name email contact phone complainantType')
    .populate('rootCauseAnalysis.completedBy', 'name email office role');

const emitGrievanceUpdate = (io, grievance) => {
  if (!io || !grievance?._id) {
    return;
  }

  const safeGrievance = sanitizeAnonymousGrievanceForResponse(grievance);
  const payload = {
    grievanceId: String(safeGrievance._id),
    data: safeGrievance,
    timestamp: new Date(),
  };

  io.to('role_admin').emit('grievance_updated', payload);
  io.to('role_superadmin').emit('grievance_updated', payload);

  const complainantId = extractObjectIdString(grievance.complainantId);
  if (complainantId) {
    io.to(`user_${complainantId}`).emit('grievance_updated', payload);
  }

  const assignedToId = extractObjectIdString(grievance.assignedTo);
  if (assignedToId) {
    io.to(`user_${assignedToId}`).emit('grievance_updated', payload);
  }
};

const runSubmissionPostProcessing = ({
  grievance,
  actor,
  combinedText,
  io,
}) => {
  setImmediate(async () => {
    const backgroundTasks = [
      notifyAdminsGrievanceSubmitted({
        grievance,
        actor,
      }).catch((error) => {
        console.error('Admin submission notification failed:', error.message);
      }),
      notifyComplainantGrievanceSubmitted({
        grievance,
        actor,
      }).catch((error) => {
        console.error('Submission notification failed:', error.message);
      }),
      (async () => {
        try {
          const aiAnalysis = await analyzeComplaintWithRetry(combinedText);
          if (!aiAnalysis) {
            await Grievance.findByIdAndUpdate(grievance._id, {
              aiAnalysisStatus: 'failed',
              aiAnalysisError: 'AI analysis returned no result',
            });
            const failedGrievance = await loadRealtimeGrievance(grievance._id);
            emitGrievanceUpdate(io, failedGrievance);
            return;
          }

          const nextPriority = mapPriorityFromAi(aiAnalysis);
          const updates = {
            aiAnalysis,
            aiAnalysisStatus: 'completed',
            aiAnalysisError: '',
            category: String(aiAnalysis?.category?.label || grievance.category || 'general').trim(),
            priority: nextPriority,
          };

          await Grievance.findByIdAndUpdate(grievance._id, updates);
          const updatedGrievance = await loadRealtimeGrievance(grievance._id);
          emitGrievanceUpdate(io, updatedGrievance);

          if (nextPriority === 'critical') {
            await notifySuperadminsCriticalGrievanceDetected({
              grievance: updatedGrievance || grievance,
              actor,
              aiAnalysis,
            }).catch((error) => {
              console.error('Critical grievance alert failed:', error.message);
            });
          }
        } catch (error) {
          console.error('AI post-processing failed:', error.message);
          await Grievance.findByIdAndUpdate(grievance._id, {
            aiAnalysisStatus: 'failed',
            aiAnalysisError: String(error.message || 'AI analysis failed').slice(0, 1000),
          }).catch(() => {});
          const failedGrievance = await loadRealtimeGrievance(grievance._id).catch(() => null);
          emitGrievanceUpdate(io, failedGrievance);
        }
      })(),
    ];

    await Promise.allSettled(backgroundTasks);
  });
};

const getComplainantSubmissionLimitStatus = async (complainantId) => {
  const settings = await getSystemSettingsSnapshot();
  const maxActiveGrievances = Number(settings.maxGrievancesPerUser) || DEFAULT_MAX_ACTIVE_GRIEVANCES;
  const now = Date.now();
  const openQuery = buildOpenGrievanceQuery({ complainantId });
  const overdueQuery = buildOpenGrievanceQuery({
    complainantId,
    createdAt: { $lte: getGrievanceOverdueDeadline(now) },
  });

  const [activeGrievanceCount, overdueUnresolvedCount, eligibleOverdueExceptionCount] = await Promise.all([
    Grievance.countDocuments(openQuery),
    Grievance.countDocuments(overdueQuery),
    Grievance.countDocuments({
      ...overdueQuery,
      submissionLimitExceptionUsed: { $ne: true },
    }),
  ]);
  const hasReachedLimit = activeGrievanceCount >= maxActiveGrievances;

  return {
    activeGrievanceCount,
    maxActiveGrievances,
    unresolvedStatuses: OPEN_GRIEVANCE_STATUSES,
    overdueUnresolvedCount,
    eligibleOverdueExceptionCount,
    hasReachedLimit,
    hasOverdueUnresolved: overdueUnresolvedCount > 0,
    hasEligibleOverdueException: hasReachedLimit && eligibleOverdueExceptionCount > 0,
    canSubmit: !hasReachedLimit || eligibleOverdueExceptionCount > 0,
  };
};

router.post('/', authenticateToken, checkRole('complainant', 'admin'), async (req, res) => {
  let consumedSubmissionLimitException = null;

  try {
    const io = req.app.get('io');
    const {
      subject,
      description,
      originalDescription = '',
      rawTranscript = '',
      personInvolved = '',
      category,
      office = null,
      department = null,
      incidentDate = '',
      priority,
      isAnonymous = false,
      attachments = [],
      conversationTranscript = [],
      chatHistory = [],
      messages = [],
    } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }

    if (req.user.role === 'complainant') {
      const limitStatus = await getComplainantSubmissionLimitStatus(req.user._id);

      if (limitStatus.hasReachedLimit) {
        const now = Date.now();
        consumedSubmissionLimitException = await Grievance.findOneAndUpdate({
          ...buildOpenGrievanceQuery({
            complainantId: req.user._id,
            createdAt: { $lte: getGrievanceOverdueDeadline(now) },
            submissionLimitExceptionUsed: { $ne: true },
          }),
        }, {
          $set: {
            submissionLimitExceptionUsed: true,
            submissionLimitExceptionUsedAt: new Date(now),
            submissionLimitExceptionUsedBy: req.user._id,
          },
        }, {
          new: true,
          sort: { createdAt: 1 },
        });

        if (!consumedSubmissionLimitException) {
          return res.status(400).json({
            success: false,
            code: 'MAX_ACTIVE_GRIEVANCES_REACHED',
            message: limitStatus.maxActiveGrievances === DEFAULT_MAX_ACTIVE_GRIEVANCES
              ? ACTIVE_GRIEVANCE_LIMIT_BLOCK_MESSAGE
              : `You currently have ${limitStatus.maxActiveGrievances} active grievances. Please wait for one of your existing grievances to be resolved or until an unresolved grievance exceeds the 72-hour processing period before submitting another concern.`,
            data: {
              ...limitStatus,
              hasEligibleOverdueException: false,
              canSubmit: false,
            },
          });
        }
      }
    }

    const normalizedSubject = String(subject).trim();
    const normalizedDescription = String(description).trim();
    const normalizedOriginalDescription = String(rawTranscript || originalDescription || '').trim();
    const normalizedPersonInvolved = String(personInvolved || '').trim();
    const normalizedIncidentDate = sanitizeIncidentDate(incidentDate);
    const complainantIdentity = getComplainantIdentity({}, req.user);
    const anonymousSubmission = !!isAnonymous;
    const safeSubject = anonymousSubmission ? sanitizeAnonymousText(normalizedSubject, complainantIdentity) : normalizedSubject;
    const safeDescription = anonymousSubmission ? sanitizeAnonymousText(normalizedDescription, complainantIdentity) : normalizedDescription;
    const safeOriginalDescription = anonymousSubmission
      ? sanitizeAnonymousText(normalizedOriginalDescription, complainantIdentity)
      : normalizedOriginalDescription;
    const safePersonInvolved = anonymousSubmission
      ? sanitizeAnonymousText(normalizedPersonInvolved, complainantIdentity)
      : normalizedPersonInvolved;
    const effectiveComplaintDescription = safeDescription;
    const combinedText = [safeSubject, effectiveComplaintDescription, safePersonInvolved, normalizedIncidentDate].filter(Boolean).join('\n');

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

    const resolvedPriority = ALLOWED_PRIORITY.includes(priority) ? priority : 'medium';
    const resolvedCategory = String(category || 'general').trim();

    const conversationSource = Array.isArray(conversationTranscript) && conversationTranscript.length
      ? conversationTranscript
      : Array.isArray(chatHistory) && chatHistory.length
        ? chatHistory
        : Array.isArray(messages)
          ? messages
          : [];
    const sanitizedConversationTranscript = sanitizeConversationTranscript(conversationSource);
    const protectedConversationTranscript = anonymousSubmission
      ? sanitizeAnonymousTranscript(sanitizedConversationTranscript, complainantIdentity)
      : sanitizedConversationTranscript;

    const grievance = await Grievance.create({
      grievanceId,
      trackingId,
      referenceNumber,
      subject: safeSubject,
      description: safeDescription,
      originalDescription: safeOriginalDescription || safeDescription,
      category: resolvedCategory,
      office: office ? String(office).trim() : null,
      department: department ? String(department).trim() : null,
      incidentDate: normalizedIncidentDate || null,
      personInvolved: safePersonInvolved || null,
      priority: resolvedPriority,
      complainantId: req.user._id,
      complainantName: anonymousSubmission ? null : req.user.name,
      complainantEmail: anonymousSubmission ? null : req.user.email,
      isAnonymous: anonymousSubmission,
      attachments: sanitizeAttachments(attachments),
      conversationTranscript: protectedConversationTranscript,
      aiAnalysis: null,
      aiAnalysisStatus: 'pending',
      aiAnalysisError: '',
      lastUpdatedBy: req.user._id,
      submissionLimitExceptionSource: consumedSubmissionLimitException?._id || null,
    });

    const createdGrievance = await loadRealtimeGrievance(grievance._id);
    emitGrievanceUpdate(io, createdGrievance);

    runSubmissionPostProcessing({
      grievance,
      actor: req.user,
      combinedText,
      io,
    });

    return res.status(201).json({
      success: true,
      message: 'Grievance created successfully',
      data: sanitizeAnonymousGrievanceForResponse(createdGrievance || grievance, req.user),
      autoAssigned: false,
      assignmentStatus: 'pending-review',
      aiAnalysis: null,
      aiAnalysisStatus: 'pending',
    });
  } catch (error) {
    console.error('Create grievance error:', error);
    if (consumedSubmissionLimitException?._id) {
      await Grievance.findByIdAndUpdate(consumedSubmissionLimitException._id, {
        $set: {
          submissionLimitExceptionUsed: false,
          submissionLimitExceptionUsedAt: null,
          submissionLimitExceptionUsedBy: null,
        },
      }).catch((rollbackError) => {
        console.error('Submission limit exception rollback failed:', rollbackError);
      });
    }
    return res.status(500).json({ success: false, message: 'Error creating grievance' });
  }
});

router.get('/mine/stats', authenticateToken, checkRole('complainant', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { complainantId: req.user._id };
    const [total, pending, inProgress, resolved, rejected] = await Promise.all([
      Grievance.countDocuments(query),
      Grievance.countDocuments({ ...query, status: { $in: ['pending', 'under_review', 'assigned_to_department'] } }),
      Grievance.countDocuments({ ...query, status: 'in_progress' }),
      Grievance.countDocuments({ ...query, status: 'resolved' }),
      Grievance.countDocuments({ ...query, status: 'rejected' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        resolved,
        rejected,
      },
    });
  } catch (error) {
    console.error('Get my grievance stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance statistics' });
  }
});

router.get('/submission-limit', authenticateToken, checkRole('complainant'), async (req, res) => {
  try {
    const status = await getComplainantSubmissionLimitStatus(req.user._id);
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get grievance submission limit status error:', error);
    return res.status(500).json({ success: false, message: 'Error checking grievance submission limit' });
  }
});

router.get('/mine', authenticateToken, checkRole('complainant', 'admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
    } = req.query;

    const query = req.user.role === 'admin' ? {} : { complainantId: req.user._id };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { referenceNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { originalDescription: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { office: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (parsedPage - 1) * parsedLimit;

    const grievances = await Grievance.find(query)
      .populate('assignedTo', 'name email office')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);
    const total = await Grievance.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievancesForResponse(grievances, req.user),
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
    console.error('Get my grievances error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievances' });
  }
});

router.get('/:id', authenticateToken, checkRole('complainant', 'admin', 'superadmin'), async (req, res) => {
  try {
    const query = { _id: req.params.id };

    if (req.user.role === 'complainant') {
      query.complainantId = req.user._id;
    }

    const grievance = await Grievance.findOne(query)
      .populate('assignedTo', 'name email office')
      .populate('complainantId', 'name email contact phone complainantType')
      .populate('rootCauseAnalysis.completedBy', 'name email office role');

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeAnonymousGrievanceForResponse(grievance, req.user),
    });
  } catch (error) {
    console.error('Get grievance by id error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching grievance' });
  }
});

router.put('/:id/satisfaction', authenticateToken, checkRole('complainant'), async (req, res) => {
  try {
    const grievance = await Grievance.findOne({
      _id: req.params.id,
      complainantId: req.user._id,
    });

    if (!grievance) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    if (grievance.status !== 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Satisfaction rating is only available after the grievance is resolved',
      });
    }

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'A satisfaction rating from 1 to 5 is required',
      });
    }

    grievance.resolutionSatisfactionRating = rating;
    grievance.resolutionSatisfactionSubmittedAt = new Date();
    grievance.lastUpdatedBy = req.user._id;
    await grievance.save();

    return res.status(200).json({
      success: true,
      message: 'Satisfaction rating saved successfully',
      data: sanitizeAnonymousGrievanceForResponse(grievance, req.user),
    });
  } catch (error) {
    console.error('Save grievance satisfaction error:', error);
    return res.status(500).json({ success: false, message: 'Error saving satisfaction rating' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    size: { type: Number, default: null },
  },
  { _id: false }
);

const conversationMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ['user', 'bot'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const grievanceSchema = new mongoose.Schema(
  {
    grievanceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    trackingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    originalDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    conversationTranscript: {
      type: [conversationMessageSchema],
      default: [],
    },
    category: {
      type: String,
      default: 'general',
      trim: true,
    },
    office: {
      type: String,
      default: null,
      trim: true,
    },
    department: {
      type: String,
      default: null,
      trim: true,
    },
    incidentDate: {
      type: String,
      default: null,
      trim: true,
    },
    personInvolved: {
      type: String,
      default: null,
      trim: true,
      maxlength: 180,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'assigned_to_department', 'in_progress', 'resolved', 'rejected', 'escalated'],
      default: 'pending',
      index: true,
    },
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    complainantName: {
      type: String,
      default: null,
      trim: true,
    },
    complainantEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    handlingLockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    handlingLockedAt: {
      type: Date,
      default: null,
    },
    handlingLockSessionId: {
      type: String,
      default: null,
      trim: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    underReviewAt: {
      type: Date,
      default: null,
    },
    departmentAssignedAt: {
      type: Date,
      default: null,
    },
    officeReceivedAt: {
      type: Date,
      default: null,
    },
    inProgressAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    overdueMemoCreated: {
      type: Boolean,
      default: false,
      index: true,
    },
    overdueMemoCreatedAt: {
      type: Date,
      default: null,
    },
    overdueMemoCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submissionLimitExceptionUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
    submissionLimitExceptionUsedAt: {
      type: Date,
      default: null,
    },
    submissionLimitExceptionUsedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submissionLimitExceptionSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      default: null,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiAnalysisStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    aiAnalysisError: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    aiAnalysisOverride: {
      summary: {
        type: String,
        default: null,
        trim: true,
        maxlength: 5000,
      },
      category: {
        label: { type: String, default: null, trim: true },
        confidence: { type: Number, default: null },
      },
      urgency: {
        label: { type: String, default: null, trim: true },
        confidence: { type: Number, default: null },
      },
      sentiment: {
        label: { type: String, default: null, trim: true },
        confidence: { type: Number, default: null },
      },
    },
    aiAnalysisOverrideBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    aiAnalysisOverrideAt: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    resolutionSatisfactionRating: {
      type: Number,
      enum: [1, 2, 3, 4, 5, null],
      default: null,
      min: 1,
      max: 5,
    },
    resolutionSatisfactionSubmittedAt: {
      type: Date,
      default: null,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    archiveReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    archiveType: {
      type: String,
      enum: ['rejected', 'deleted', 'monthly_reset', null],
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rootCauseAnalysis: {
      problemSummary: {
        type: String,
        default: null,
        trim: true,
        maxlength: 2000,
      },
      rootCauseCategory: {
        type: String,
        enum: [
          'academic_performance',
          'administrative_process',
          'personnel_conduct',
          'harassment_discrimination',
          'infrastructure_facilities',
          'service_quality',
          'policy_enforcement',
          'others',
          null,
        ],
        default: null,
      },
      rootCauseDescription: {
        type: String,
        default: null,
        trim: true,
        maxlength: 3000,
      },
      actionTaken: {
        type: String,
        default: null,
        trim: true,
        maxlength: 3000,
      },
      preventiveAction: {
        type: String,
        default: null,
        trim: true,
        maxlength: 3000,
      },
      fishbone: {
        people: {
          type: [String],
          default: [],
        },
        process: {
          type: [String],
          default: [],
        },
        policy: {
          type: [String],
          default: [],
        },
        systemTechnology: {
          type: [String],
          default: [],
        },
        environment: {
          type: [String],
          default: [],
        },
        // Legacy field retained for backward compatibility with older RCA records.
        evidence: {
          type: [String],
          default: [],
        },
      },
      resolutionEvidence: {
        type: [attachmentSchema],
        default: [],
      },
      responsibleOffice: {
        type: String,
        default: null,
        trim: true,
      },
      resolutionDate: {
        type: Date,
        default: null,
      },
      rcaStatus: {
        type: String,
        enum: ['in_progress', 'resolved', null],
        default: null,
      },
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      completedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Grievance', grievanceSchema);

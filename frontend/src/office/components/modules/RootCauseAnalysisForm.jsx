import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import authService from '../../../services/authService';
import cloudinaryService from '../../../services/cloudinaryService';
import { BACKEND_URL } from '../../../config/api';
import {
  formatOfficeLabel,
  getAttachmentDisplayName,
  getResolutionEvidence,
  RCA_FISHBONE_SECTIONS,
  resolveAttachmentUrl,
} from '../../../utils/rcaReport';

const API_BASE = BACKEND_URL;

const textareaMinHeights = {
  problemSummary: 148,
  rootCauseDescription: 170,
  actionTaken: 170,
  preventiveAction: 170,
};

const emptyFishbone = () => ({
  people: [''],
  process: [''],
  policy: [''],
  systemTechnology: [''],
  environment: [''],
});

const defaultFormData = {
  problemSummary: '',
  rootCauseCategory: '',
  rootCauseDescription: '',
  actionTaken: '',
  preventiveAction: '',
  rcaStatus: 'in_progress',
  fishbone: emptyFishbone(),
  resolutionEvidence: [],
};

const RCA_WORKFLOW_STEPS = [
  {
    key: 'fishbone',
    title: 'Fishbone Analysis',
    purpose: 'Identify possible contributing factors that may have led to the grievance.',
  },
  {
    key: 'rootCause',
    title: 'Root Cause Analysis',
    purpose: 'Based on the contributing factors identified in the Fishbone Analysis, determine and document the underlying root cause.',
  },
  {
    key: 'resolution',
    title: 'Resolution & Prevention',
    purpose: 'Document how the issue was addressed and how recurrence will be prevented.',
  },
];

const normalizeFishboneList = (values = []) => {
  const trimmed = (Array.isArray(values) ? values : []).map((value) => String(value || '').trim());
  const nonEmpty = trimmed.filter(Boolean);

  return nonEmpty.length > 0 ? trimmed : [''];
};

const buildFishboneFromRca = (rca) => ({
  people: normalizeFishboneList(rca?.fishbone?.people),
  process: normalizeFishboneList(rca?.fishbone?.process),
  policy: normalizeFishboneList(rca?.fishbone?.policy),
  systemTechnology: normalizeFishboneList(rca?.fishbone?.systemTechnology),
  environment: normalizeFishboneList(rca?.fishbone?.environment),
});

const inferRootCauseCategory = (grievance) => {
  const text = `${grievance?.category || ''} ${grievance?.subject || ''} ${grievance?.description || ''}`.toLowerCase();

  if (/(harass|bully|discriminat|abuse|sexual)/.test(text)) {
    return 'harassment_discrimination';
  }

  if (/(instructor|teacher|staff|faculty|conduct|professional|behavior)/.test(text)) {
    return 'personnel_conduct';
  }

  if (/(registration|enrollment|clearance|document|policy|process|admin)/.test(text)) {
    return 'administrative_process';
  }

  if (/(facility|laboratory|lab|classroom|building|equipment|internet|computer)/.test(text)) {
    return 'infrastructure_facilities';
  }

  if (/(service|support|response|responsiveness|assistance)/.test(text)) {
    return 'service_quality';
  }

  if (/(rule|violation|discipline|enforcement)/.test(text)) {
    return 'policy_enforcement';
  }

  if (/(grade|course|subject|curriculum|lesson|academic|exam|content)/.test(text)) {
    return 'academic_performance';
  }

  return 'others';
};

const buildFormDataFromRca = (rca, grievance) => ({
  problemSummary: rca?.problemSummary || '',
  rootCauseCategory: rca?.rootCauseCategory || inferRootCauseCategory(grievance),
  rootCauseDescription: rca?.rootCauseDescription || '',
  actionTaken: rca?.actionTaken || '',
  preventiveAction: rca?.preventiveAction || '',
  rcaStatus: rca?.rcaStatus === 'resolved' ? 'resolved' : 'in_progress',
  fishbone: buildFishboneFromRca(rca),
  resolutionEvidence: getResolutionEvidence(rca),
});

const buildPayloadFromForm = (formData, resolutionEvidence = formData.resolutionEvidence) => ({
  problemSummary: formData.problemSummary,
  rootCauseCategory: formData.rootCauseCategory,
  rootCauseDescription: formData.rootCauseDescription,
  actionTaken: formData.actionTaken,
  preventiveAction: formData.preventiveAction,
  rcaStatus: formData.rcaStatus === 'resolved' ? 'resolved' : 'in_progress',
  fishbone: {
    people: formData.fishbone.people.map((value) => String(value || '').trim()).filter(Boolean),
    process: formData.fishbone.process.map((value) => String(value || '').trim()).filter(Boolean),
    policy: formData.fishbone.policy.map((value) => String(value || '').trim()).filter(Boolean),
    systemTechnology: formData.fishbone.systemTechnology.map((value) => String(value || '').trim()).filter(Boolean),
    environment: formData.fishbone.environment.map((value) => String(value || '').trim()).filter(Boolean),
  },
  resolutionEvidence,
});

const hasFishboneCause = (fishbone = {}) =>
  RCA_FISHBONE_SECTIONS.some(({ key }) =>
    Array.isArray(fishbone?.[key]) && fishbone[key].some((value) => String(value || '').trim())
  );

const formatFileSize = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const RequiredAsterisk = () => <span className="text-rose-500">*</span>;

const InfoCard = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold leading-6 text-slate-900">{value}</p>
  </div>
);

const SectionCard = ({ eyebrow, title, subtitle, children }) => (
  <section className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-5">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>}
      <h3 className="mt-1 text-xl font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

const Stepper = ({ activeStep }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="grid grid-cols-3 gap-2">
      {RCA_WORKFLOW_STEPS.map((step, index) => {
        const isActive = activeStep === index;
        const isComplete = activeStep > index;

        return (
          <div
            key={step.key}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : isComplete
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-slate-50 text-slate-500'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isActive ? 'bg-white text-blue-700' : 'bg-white text-slate-500'}`}>
              {index + 1}
            </span>
            <p className="truncate text-xs font-semibold sm:text-sm">{step.title}</p>
          </div>
        );
      })}
    </div>
  </div>
);

const FloatingField = ({ label, required, helperText, count, children }) => (
  <div className="space-y-3">
    <div className="flex items-start justify-between gap-4">
      <div>
        <label className="text-sm font-semibold text-slate-800">
          {label} {required && <RequiredAsterisk />}
        </label>
        {helperText && <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>}
      </div>
      {count != null && <span className="pt-0.5 text-xs font-medium text-slate-400">{count}</span>}
    </div>
    {children}
  </div>
);

const FishboneFieldGroup = ({
  title,
  subtitle,
  values,
  onChange,
  onAdd,
  onRemove,
  optional = false,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
      >
        Add Cause
      </button>
    </div>

    <div className="mt-5 space-y-3">
      {values.map((value, index) => (
        <div key={`${title}-${index}`} className="flex items-start gap-3">
          <textarea
            value={value}
            onChange={(event) => onChange(index, event.target.value)}
            placeholder={optional ? 'Optional supporting entry' : 'Describe a contributing cause'}
            rows={2}
            maxLength={500}
            className="min-h-[84px] w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={values.length === 1}
            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  </div>
);

const RootCauseAnalysisForm = ({ grievance, onResolved, onClose, onLockConflict }) => {
  const token = authService.getToken();
  const clientSessionId = authService.getClientSessionId();
  const textareaRefs = useRef({});
  const previousGrievanceIdRef = useRef('');
  const formDirtyRef = useRef(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolutionConfirm, setResolutionConfirm] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [resolutionEvidenceFiles, setResolutionEvidenceFiles] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!grievance?._id) {
      previousGrievanceIdRef.current = '';
      setFormData(defaultFormData);
      setResolutionEvidenceFiles([]);
      setFormDirty(false);
      setActiveStep(0);
      return;
    }

    const grievanceChanged = previousGrievanceIdRef.current !== grievance._id;
    previousGrievanceIdRef.current = grievance._id;

    if (grievanceChanged || !formDirtyRef.current) {
      setFormData(buildFormDataFromRca(grievance.rootCauseAnalysis, grievance));
      setResolutionEvidenceFiles([]);
      setFormDirty(false);
      setActiveStep(0);
    }
  }, [grievance]);

  useEffect(() => {
    formDirtyRef.current = formDirty;
  }, [formDirty]);

  const resizeTextarea = (field) => {
    const textarea = textareaRefs.current[field];
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(textarea.scrollHeight, textareaMinHeights[field] || 148)}px`;
  };

  useEffect(() => {
    Object.keys(textareaMinHeights).forEach((field) => resizeTextarea(field));
  }, [
    formData.problemSummary,
    formData.rootCauseDescription,
    formData.actionTaken,
    formData.preventiveAction,
    activeStep,
  ]);

  const rootCauseStepComplete =
    formData.problemSummary?.trim() &&
    formData.rootCauseDescription?.trim();
  const fishboneStepComplete = hasFishboneCause(formData.fishbone);

  const isComplete =
    fishboneStepComplete &&
    formData.problemSummary?.trim() &&
    formData.rootCauseCategory &&
    formData.rootCauseDescription?.trim() &&
    formData.actionTaken?.trim() &&
    formData.preventiveAction?.trim();

  if (!grievance) return null;

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFormDirty(true);
  };

  const handleTextareaChange = (field) => (event) => {
    handleFieldChange(field, event.target.value);
    requestAnimationFrame(() => resizeTextarea(field));
  };

  const handleNextStep = () => {
    setError('');

    if (activeStep === 0 && !fishboneStepComplete) {
      setError('Please enter at least one contributing factor in the Fishbone Analysis before continuing.');
      return;
    }

    if (activeStep === 1 && !rootCauseStepComplete) {
      setError('Please complete Problem Summary and Root Cause Description before continuing to Resolution & Prevention.');
      return;
    }

    setActiveStep((current) => Math.min(current + 1, RCA_WORKFLOW_STEPS.length - 1));
  };

  const handlePreviousStep = () => {
    setError('');
    setActiveStep((current) => Math.max(current - 1, 0));
  };

  const handleRequestResolutionConfirm = () => {
    if (!isComplete) {
      setActiveStep(!fishboneStepComplete ? 0 : formData.problemSummary?.trim() && formData.rootCauseDescription?.trim() ? 2 : 1);
      setError('Please complete all required fields before marking as resolved.');
      return;
    }

    setError('');
    setResolutionConfirm(true);
  };

  const handleFishboneChange = (sectionKey, index, value) => {
    setFormData((current) => ({
      ...current,
      fishbone: {
        ...current.fishbone,
        [sectionKey]: current.fishbone[sectionKey].map((entry, entryIndex) => (
          entryIndex === index ? value : entry
        )),
      },
    }));
    setFormDirty(true);
  };

  const handleFishboneAdd = (sectionKey) => {
    setFormData((current) => ({
      ...current,
      fishbone: {
        ...current.fishbone,
        [sectionKey]: [...current.fishbone[sectionKey], ''],
      },
    }));
    setFormDirty(true);
  };

  const handleFishboneRemove = (sectionKey, index) => {
    setFormData((current) => {
      const nextValues = current.fishbone[sectionKey].filter((_, entryIndex) => entryIndex !== index);

      return {
        ...current,
        fishbone: {
          ...current.fishbone,
          [sectionKey]: nextValues.length > 0 ? nextValues : [''],
        },
      };
    });
    setFormDirty(true);
  };

  const handleResolutionEvidenceSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setResolutionEvidenceFiles((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const nextFiles = [...current];

      files.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          nextFiles.push(file);
        }
      });

      return nextFiles;
    });
    setFormDirty(true);
    event.target.value = '';
  };

  const handleRemovePendingEvidence = (index) => {
    setResolutionEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setFormDirty(true);
  };

  const handleRemoveUploadedEvidence = (index) => {
    setFormData((current) => ({
      ...current,
      resolutionEvidence: current.resolutionEvidence.filter((_, attachmentIndex) => attachmentIndex !== index),
    }));
    setFormDirty(true);
  };

  const uploadResolutionEvidence = async () => {
    if (resolutionEvidenceFiles.length === 0) {
      return [];
    }

    const uploadResults = await cloudinaryService.uploadMultipleFilesToCloudinary(resolutionEvidenceFiles);
    const uploadedEvidence = uploadResults
      .filter((result) => result?.success || result?.url)
      .map((result) => ({
        url: result.url,
        publicId: result.publicId,
        fileName: result.originalName,
        fileType: result.format,
        size: result.size,
      }));

    const failedUploads = uploadResults.filter((result) => !(result?.success || result?.url));
    if (failedUploads.length > 0) {
      throw new Error('One or more resolution evidence files failed to upload. Please try again.');
    }

    return uploadedEvidence;
  };

  const handleMarkAsResolved = async () => {
    const trimmedResolutionNotes = String(formData.actionTaken || '').trim();

    if (!isComplete) {
      setActiveStep(!fishboneStepComplete ? 0 : formData.problemSummary?.trim() && formData.rootCauseDescription?.trim() ? 2 : 1);
      setError('Please complete all required fields before marking as resolved.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const uploadedResolutionEvidence = await uploadResolutionEvidence();
      const mergedResolutionEvidence = [...formData.resolutionEvidence, ...uploadedResolutionEvidence];

      const response = await axios.put(
        `${API_BASE}/api/offices/grievances/${grievance._id}/rca/resolve`,
        {
          ...buildPayloadFromForm({ ...formData, rcaStatus: 'resolved' }, mergedResolutionEvidence),
          rcaStatus: 'resolved',
          resolutionNotes: trimmedResolutionNotes,
        },
        { headers: { Authorization: `Bearer ${token}`, "X-Client-Session-Id": clientSessionId } }
      );

      if (response.data?.success) {
        const resolvedGrievance = response.data?.data;
        setFormData(buildFormDataFromRca(resolvedGrievance?.rootCauseAnalysis, resolvedGrievance));
        setResolutionEvidenceFiles([]);
        setFormDirty(false);
        setSuccess('Grievance marked as resolved and complainant notified.');
        setResolutionConfirm(false);
        onResolved?.(resolvedGrievance);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to mark as resolved';
      if (err.response?.status === 409 && err.response?.data?.data) {
        onLockConflict?.(err.response.data.data);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 bg-slate-50 p-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Case Context</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-slate-900">{grievance.subject || 'Case Resolution Analysis'}</h3>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isComplete ? 'Ready for review' : 'Draft in progress'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <InfoCard label="Tracking ID" value={grievance.referenceNumber || grievance.trackingId || '--'} />
          <InfoCard
            label="Complainant"
            value={
              grievance.isAnonymous
                ? 'Anonymous'
                : grievance.complainantName || grievance.complainantId?.name || 'Anonymous'
            }
          />
          <InfoCard label="Office / Department" value={formatOfficeLabel(grievance.office || grievance.department || '--')} />
          <InfoCard label="Filed On" value={new Date(grievance.createdAt).toLocaleString()} />
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <Stepper activeStep={activeStep} />

      {activeStep === 0 && (
        <SectionCard
          eyebrow="Step 1 - Fishbone"
          title={<>Fishbone Analysis <RequiredAsterisk /></>}
          subtitle="Identify possible contributing factors that may have led to the grievance."
        >
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            At least one contributing factor is required before proceeding to the Root Cause Analysis.
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {RCA_FISHBONE_SECTIONS.map(({ key, title, subtitle }) => (
              <FishboneFieldGroup
                key={key}
                title={title}
                subtitle={subtitle}
                values={formData.fishbone[key]}
                onChange={(index, value) => handleFishboneChange(key, index, value)}
                onAdd={() => handleFishboneAdd(key)}
                onRemove={(index) => handleFishboneRemove(key, index)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {activeStep === 1 && (
        <SectionCard
          eyebrow="Step 2 - Root Cause"
          title="Root Cause Analysis"
          subtitle="Based on the contributing factors identified in the Fishbone Analysis, determine and document the underlying root cause."
        >
          <FloatingField
            label="Problem Summary"
            required
            helperText="Briefly summarize the grievance, impact, and immediate concern."
            count={`${formData.problemSummary.length}/2000`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-0 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                Problem Summary <RequiredAsterisk />
              </span>
              <textarea
                ref={(node) => {
                  textareaRefs.current.problemSummary = node;
                }}
                value={formData.problemSummary}
                onChange={handleTextareaChange('problemSummary')}
                placeholder="Brief overview of the grievance and its impact"
                maxLength="2000"
                rows={5}
                className="min-h-[190px] w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </FloatingField>

          <FloatingField
            label="Root Cause Category"
            required
            helperText="Automatically determined from the existing grievance details."
          >
            <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
              {formatOfficeLabel(formData.rootCauseCategory || '--')}
            </div>
          </FloatingField>

          <FloatingField
            label="Root Cause Description"
            required
            helperText="Explain the underlying reason this grievance occurred."
            count={`${formData.rootCauseDescription.length}/3000`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-0 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                Root Cause Description <RequiredAsterisk />
              </span>
              <textarea
                ref={(node) => {
                  textareaRefs.current.rootCauseDescription = node;
                }}
                value={formData.rootCauseDescription}
                onChange={handleTextareaChange('rootCauseDescription')}
                placeholder="Detailed explanation of the underlying cause"
                maxLength="3000"
                rows={6}
                className="min-h-[220px] w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </FloatingField>
        </SectionCard>
      )}

      {activeStep === 2 && (
        <SectionCard
          eyebrow="Step 3 - Resolution"
          title="Resolution & Prevention"
          subtitle="Document how the issue was addressed and how recurrence will be prevented."
        >
          <FloatingField
            label="Action Taken"
            required
            helperText="Describe the resolution steps already carried out by the office."
            count={`${formData.actionTaken.length}/3000`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-0 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                Action Taken <RequiredAsterisk />
              </span>
              <textarea
                ref={(node) => {
                  textareaRefs.current.actionTaken = node;
                }}
                value={formData.actionTaken}
                onChange={handleTextareaChange('actionTaken')}
                placeholder="Steps taken to resolve the grievance"
                maxLength="3000"
                rows={6}
                className="min-h-[200px] w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </FloatingField>

          <FloatingField
            label="Preventive Action"
            required
            helperText="State the controls, changes, or monitoring plan that will prevent recurrence."
            count={`${formData.preventiveAction.length}/3000`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-0 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                Preventive Action <RequiredAsterisk />
              </span>
              <textarea
                ref={(node) => {
                  textareaRefs.current.preventiveAction = node;
                }}
                value={formData.preventiveAction}
                onChange={handleTextareaChange('preventiveAction')}
                placeholder="Measures to prevent similar issues in the future"
                maxLength="3000"
                rows={6}
                className="min-h-[200px] w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </FloatingField>

          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-800">Resolution Evidence</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Attach files that prove the grievance was addressed. These files will be visible in the complainant view and included in the resolution email.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">Supporting Proof</h4>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Upload screenshots, signed documents, photos, PDFs, or videos that show the corrective action has already been completed.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                  Add Evidence
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.mp4,.avi,.mov"
                    className="hidden"
                    onChange={handleResolutionEvidenceSelection}
                  />
                </label>
              </div>

              {formData.resolutionEvidence.length === 0 && resolutionEvidenceFiles.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-5 py-6 text-sm text-slate-500">
                  No resolution evidence uploaded yet.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {formData.resolutionEvidence.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Uploaded Evidence</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {formData.resolutionEvidence.map((attachment, index) => {
                          const url = resolveAttachmentUrl(attachment);
                          const fileName = getAttachmentDisplayName(attachment, index, 'Resolution Evidence');

                          return (
                            <div key={`${url || fileName}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{fileName}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                  {[attachment.fileType, formatFileSize(attachment.size)].filter(Boolean).join(' | ') || 'Uploaded evidence'}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                                  >
                                    Open
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUploadedEvidence(index)}
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {resolutionEvidenceFiles.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pending Upload</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {resolutionEvidenceFiles.map((file, index) => (
                          <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                {[file.type || '', formatFileSize(file.size)].filter(Boolean).join(' | ') || 'Pending upload'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePendingEvidence(index)}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <div className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            {activeStep === 0 && 'Enter at least one contributing factor before continuing.'}
            {activeStep === 1 && 'Complete Problem Summary and Root Cause Description before proceeding.'}
            {activeStep === 2 && (
              isComplete
                ? 'All required RCA fields are complete. You can proceed to resolution.'
                : 'Complete all required fields and sections marked with * before confirming resolution.'
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
            {activeStep > 0 && (
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
            )}
            {activeStep < RCA_WORKFLOW_STEPS.length - 1 && (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={loading}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            )}
            {activeStep === RCA_WORKFLOW_STEPS.length - 1 && (
              <button
                type="button"
                onClick={handleRequestResolutionConfirm}
                disabled={loading || !isComplete}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark as Resolved
              </button>
            )}
          </div>
        </div>
      </div>

      {resolutionConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="relative z-[71] w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resolution Review</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Confirm Resolution</h3>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Mark this grievance as resolved? A notification will be sent to the complainant and the current RCA content will be saved with the grievance resolution record.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setResolutionConfirm(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkAsResolved}
                disabled={loading}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm & Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RootCauseAnalysisForm;

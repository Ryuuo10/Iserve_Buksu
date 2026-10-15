import { normalizeAiCategoryLabel, getModelAnalysisForDisplay, isPredefinedAiAnalysis } from '../../../utils/aiAnalysis';

const fmtStatus = (v) => String(v || '').replace('_', ' ').toUpperCase();
const fmtReadable = (value, fallback = '--') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};
const fmtConfidence = (value) => {
  if (value == null || value === '') return '--';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '--';
  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(1)}%`;
};
const normalizePriorityLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return normalized === 'urgent' ? 'critical' : normalized;
};
const formatPriorityLabel = (value, fallback = '--') => {
  const normalized = normalizePriorityLabel(value);
  if (!normalized) return fallback;
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};
const normalizeConfidenceInput = (value) => {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  return numeric;
};
const COMPLAINT_TYPE_OPTIONS = [
  'Academic Issues',
  'Administrative Concerns',
  'Facility Problems',
  'Financial Matters',
  'Harassment/Discrimination',
  'Unfair Treatment',
  'Service Quality',
  'Policy Enforcement',
  'Other',
];
const URGENCY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const SENTIMENT_OPTIONS = ['Negative', 'Neutral', 'Positive'];
const DETAIL_LINE_LABELS = new Set([
  'Location',
  'Incident Date',
  'Person Involved',
  'Office',
  'Department',
]);

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

const getOfficeCollegeAcronym = (value) => {
  const text = String(value || '').trim().replace(/[_-]+/g, ' ');
  const parenthesized = text.match(/\(([A-Za-z]{2,6})\)/);
  if (parenthesized?.[1]) {
    return parenthesized[1].toUpperCase();
  }
  return '';
};

const findOfficeByValue = (value, offices = []) => {
  const normalized = normalizeOfficeKey(value);
  if (!normalized) return null;
  return offices.find((office) =>
    [office?.name, office?.officeName, office?.id, office?.slug, office?.college]
      .filter(Boolean)
      .some((candidate) => normalizeOfficeKey(candidate) === normalized)
  ) || null;
};

const findCollegeMatch = (value, offices = []) => {
  const normalized = normalizeOfficeKey(value);
  const acronym = getOfficeCollegeAcronym(value);
  if (!normalized && !acronym) return null;
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

const resolveConcernedOfficeDetails = (grievance, offices = []) => {
  const rawOffice = grievance?.office || '';
  const rawDepartment = isBlankDepartmentValue(grievance?.department) ? '' : String(grievance?.department || '').trim();
  const exactOffice = findOfficeByValue(rawOffice, offices);
  const collegeMatch = exactOffice || findCollegeMatch(rawOffice, offices);
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

const findRouteCategory = (college, level, department = '', offices = []) => {
  if (!college) return null;
  return offices.find((office) => {
    const sameCollege = normalizeOfficeKey(office?.college) === normalizeOfficeKey(college);
    if (!sameCollege) return false;
    if (level === 'college') {
      return !String(office?.department || '').trim();
    }
    return normalizeOfficeKey(office?.department) === normalizeOfficeKey(department);
  }) || null;
};

const parseDescriptionDetails = (description = '') => {
  const lines = String(description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const details = [];
  const narrative = [];

  lines.forEach((line) => {
    const match = line.match(/^([^:]{2,40}):\s*(.*)$/);
    const label = match?.[1]?.trim();
    if (label && DETAIL_LINE_LABELS.has(label)) {
      details.push({
        label,
        value: match[2]?.trim() || 'N/A',
      });
      return;
    }

    narrative.push(line);
  });

  return {
    narrative: narrative.join('\n').trim(),
    details,
  };
};

const resolveOfficeSelection = (grievance, offices = []) => {
  if (!grievance) {
    return '';
  }

  const concerned = resolveConcernedOfficeDetails(grievance, offices);
  const departmentRoute = concerned.department
    ? findRouteCategory(concerned.college, 'department', concerned.department, offices)
    : null;
  if (departmentRoute?.name) {
    return departmentRoute.name;
  }

  const collegeRoute = findRouteCategory(concerned.college, 'college', '', offices);
  if (collegeRoute?.name) {
    return collegeRoute.name;
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
      [office?.name, office?.officeName, office?.id, office?.slug].some(
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

const GrievanceEditModal = ({
  isOpen,
  grievance,
  offices = [],
  value,
  saving = false,
  reanalyzing = false,
  onReanalyze,
  currentUser,
  onChange,
  onSave,
  onClose,
}) => {
  if (!isOpen || !grievance) return null;

  const officeOptions = Array.isArray(offices)
    ? offices
        .map((office) => ({
          value: office?.name || office?.officeName || office?.id || office,
          label: office?.college
            ? `${fmtReadable(office.college)}${office.department ? ` - ${fmtReadable(office.department)}` : ''} (${office.department ? 'Department-level' : 'College-level'})`
            : (office?.name || office?.officeName || office?.id || office),
        }))
        .filter((office) => office.value)
        .filter((office, index, all) => all.findIndex((item) => item.value === office.value) === index)
    : [];
  const selectedStatus = value?.status || grievance.status || 'pending';
  const selectedOffice =
    value?.office || resolveOfficeSelection(grievance, offices);
  const concernedOfficeDetails = resolveConcernedOfficeDetails(grievance, offices);
  const parsedDescription = parseDescriptionDetails(grievance.description);
  const isRejectedSelection = selectedStatus === 'rejected';
  const hasOverride = !!grievance.aiAnalysisOverrideAt;
  const modelAnalysis = getModelAnalysisForDisplay(grievance.aiAnalysis);
  const effectiveAnalysis = hasOverride
    ? {
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
      }
    : modelAnalysis;
  const aiStatus = isPredefinedAiAnalysis(grievance.aiAnalysis) ? 'failed' : grievance.aiAnalysisStatus;
  const aiCategoryLabel = normalizeAiCategoryLabel(effectiveAnalysis?.category?.label, '');
  const aiUrgencyLabel = effectiveAnalysis?.urgency?.label;
  const aiSentimentLabel = effectiveAnalysis?.sentiment?.label;
  const aiFallbackLabel = aiStatus === 'pending' ? 'Analyzing' : aiStatus === 'failed' ? 'Unavailable' : '--';
  const complaintTypeLabel = aiCategoryLabel || aiFallbackLabel;
  const urgencyLevelLabel = aiUrgencyLabel ? formatPriorityLabel(aiUrgencyLabel, aiFallbackLabel) : aiFallbackLabel;
  const sentimentLabel = aiSentimentLabel || aiFallbackLabel;
  const overrideTimestamp = grievance.aiAnalysisOverrideAt
    ? new Date(grievance.aiAnalysisOverrideAt).toLocaleString()
    : '';
  const isSuperadmin = currentUser?.role === 'superadmin';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-2xl font-bold">Edit Grievance</h2>
            <p className="text-white/80 text-sm">Tracking ID: {grievance.referenceNumber || grievance.trackingId}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-8 py-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
              <input
                value={grievance.subject || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">Subject cannot be changed by admins.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Complainant</label>
              <input
                value={grievance.isAnonymous ? 'Anonymous' : grievance.complainantName || grievance.complainantId?.name || '--'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concerned Office / Department</p>
            <p className="mt-2 text-sm text-slate-600">
              Read-only information retrieved from the submitted grievance. Use it as the starting point for final routing.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Concerned Office</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fmtReadable(concernedOfficeDetails.college)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Concerned Department</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {concernedOfficeDetails.department ? fmtReadable(concernedOfficeDetails.department) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  onChange({
                    ...(value || {}),
                    status: e.target.value,
                    office: selectedOffice,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {['pending', 'under_review', 'rejected'].map((status) => (
                  <option key={status} value={status}>
                    {fmtStatus(status)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Final Routing</label>
              <select
                value={selectedOffice}
                onChange={(e) => onChange({ ...(value || {}), office: e.target.value })}
                disabled={isRejectedSelection}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value="">Unassigned</option>
                {officeOptions.map((office) => (
                  <option key={office.value} value={office.value}>
                    {office.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {isRejectedSelection
                  ? 'Office routing is disabled when the grievance status is Rejected.'
                  : 'Admin final routing decision. The concerned office above is the suggested starting point.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Complaint Narrative</p>
              </div>
              <div className="px-5 py-5">
                <p className="whitespace-pre-wrap break-words text-left text-sm leading-7 text-slate-800">
                  {parsedDescription.narrative || grievance.originalDescription || grievance.description || '--'}
                </p>

                {parsedDescription.details.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {parsedDescription.details.map((detail) => (
                      <div
                        key={detail.label}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {detail.label}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                          {detail.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">The grievance content is read-only in admin edit mode.</p>
          </div>

          {isSuperadmin && onReanalyze && (
            <div className="flex justify-end">
              <button type="button" onClick={onReanalyze} disabled={saving}
                className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50">
                {reanalyzing ? 'Analyzing...' : 'Reanalyze with AI'}
              </button>
            </div>
          )}

          {modelAnalysis || hasOverride ? (
            <div className="rounded-[26px] border border-sky-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_rgba(255,255,255,0.96)_55%)] p-5 shadow-[0_20px_55px_-34px_rgba(14,165,233,0.45)] text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">AI Analysis</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {hasOverride ? 'Admin override applied. Original AI output retained in history.' : 'Generated by the trained complaint-analysis models.'}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                  {hasOverride ? 'Admin Edited' : 'Model Complete'}
                </span>
              </div>

              {hasOverride && overrideTimestamp && (
                <p className="mt-3 text-xs font-medium text-slate-500">Edited on {overrideTimestamp}</p>
              )}

              {effectiveAnalysis?.summary && (
                <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Summary</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800 text-left">{effectiveAnalysis.summary}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="min-w-0 rounded-2xl border border-sky-100 bg-white/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Complaint Type</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{complaintTypeLabel}</p>
                  <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.category?.confidence)}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-amber-100 bg-white/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Urgency Level</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{urgencyLevelLabel}</p>
                  <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.urgency?.confidence)}</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Sentiment</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">{sentimentLabel}</p>
                  <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.sentiment?.confidence)}</p>
                </div>
              </div>
            </div>
          ) : aiStatus === 'pending' ? (
            <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(245,158,11,0.32)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">AI Analysis</p>
              <p className="mt-3 text-sm font-medium text-amber-900">The trained models are still analyzing this complaint.</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">This panel will update automatically with complaint type, urgency level, summary, and sentiment.</p>
            </div>
          ) : aiStatus === 'failed' ? (
            <div className="rounded-[26px] border border-rose-200 bg-[linear-gradient(135deg,rgba(251,113,133,0.14),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(244,63,94,0.26)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">AI Analysis</p>
              <p className="mt-3 text-sm font-medium text-rose-900">{isPredefinedAiAnalysis(grievance.aiAnalysis) ? 'The saved result was rule-based, not a trained model prediction. Reanalyze this case to obtain model confidence.' : 'The grievance was saved, but the AI analysis could not be generated yet.'}</p>
              <p className="mt-2 text-sm leading-6 text-rose-800">Please verify that the local AI models and Python dependencies are available on the backend server.</p>
              {grievance.aiAnalysisError && (
                <div className="mt-4 rounded-2xl border border-rose-100 bg-white/85 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Error Detail</p>
                  <p className="mt-2 break-words font-mono text-xs leading-6 text-rose-900">{grievance.aiAnalysisError}</p>
                </div>
              )}
            </div>
          ) : null}

          {isSuperadmin && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin Override</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Edit the AI output for this grievance. Overrides are saved with your name and timestamp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...(value || {}), aiOverrideEnabled: !(value?.aiOverrideEnabled) })}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    value?.aiOverrideEnabled
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {value?.aiOverrideEnabled ? 'Override Enabled' : 'Override Disabled'}
                </button>
              </div>

              {value?.aiOverrideEnabled && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Summary Override</label>
                    <textarea
                      value={value?.aiOverrideSummary || ''}
                      onChange={(e) => onChange({ ...(value || {}), aiOverrideSummary: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Provide a corrected summary..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Complaint Type</p>
                      <select
                        value={value?.aiOverrideCategoryLabel || ''}
                        onChange={(e) => onChange({ ...(value || {}), aiOverrideCategoryLabel: e.target.value })}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select type</option>
                        {COMPLAINT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <div className="mt-3">
                        <label className="text-xs text-slate-500">AI Confidence %</label>
                        <input
                          value={value?.aiOverrideCategoryConfidence ?? ''}
                          onChange={(e) => onChange({ ...(value || {}), aiOverrideCategoryConfidence: normalizeConfidenceInput(e.target.value) })}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Urgency Level</p>
                      <select
                        value={value?.aiOverrideUrgencyLabel || ''}
                        onChange={(e) => onChange({ ...(value || {}), aiOverrideUrgencyLabel: e.target.value })}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select urgency</option>
                        {URGENCY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <div className="mt-3">
                        <label className="text-xs text-slate-500">AI Confidence %</label>
                        <input
                          value={value?.aiOverrideUrgencyConfidence ?? ''}
                          onChange={(e) => onChange({ ...(value || {}), aiOverrideUrgencyConfidence: normalizeConfidenceInput(e.target.value) })}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Sentiment</p>
                      <select
                        value={value?.aiOverrideSentimentLabel || ''}
                        onChange={(e) => onChange({ ...(value || {}), aiOverrideSentimentLabel: e.target.value })}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select sentiment</option>
                        {SENTIMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <div className="mt-3">
                        <label className="text-xs text-slate-500">AI Confidence %</label>
                        <input
                          value={value?.aiOverrideSentimentConfidence ?? ''}
                          onChange={(e) => onChange({ ...(value || {}), aiOverrideSentimentConfidence: normalizeConfidenceInput(e.target.value) })}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrievanceEditModal;

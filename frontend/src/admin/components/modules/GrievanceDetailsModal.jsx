import RootCauseAnalysisView, { FishboneAnalysisPanel } from './RootCauseAnalysisView';
import { hasFishboneContent, hasRcaContent } from '../../../utils/rcaReport';
import GrievanceStatusTracker from '../../../complainant/components/modules/GrievanceStatusTracker';
import { normalizeAiCategoryLabel, getModelAnalysisForDisplay, isPredefinedAiAnalysis } from '../../../utils/aiAnalysis';
import { getGrievanceSlaStatus } from '../../../utils/grievanceSla';
import ConversationTranscript from '../../../components/ConversationTranscript';
import AttachmentPreviewCard from '../../../components/AttachmentPreviewCard';

const InfoField = ({ label, value, subtle }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className={`mt-2 text-sm ${subtle ? 'text-slate-500' : 'text-slate-900'}`}>{value}</p>
  </div>
);

const SectionBlock = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-6 py-4 text-left">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    <div className="p-6 text-left">{children}</div>
  </section>
);

const SATISFACTION_LABELS = {
  1: 'Very Dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral',
  4: 'Satisfied',
  5: 'Very Satisfied',
};

const getOriginalDescription = (grievance) =>
  String(grievance?.originalDescription || grievance?.description || '').trim();
const getProcessedDescription = (grievance) =>
  String(grievance?.description || '').trim();
const hasDistinctProcessedDescription = (grievance) => {
  const original = getOriginalDescription(grievance);
  const processed = getProcessedDescription(grievance);
  return !!(original && processed && original !== processed);
};

const GrievanceDetailsModal = ({ isOpen, grievance, onClose, currentUser, onStatusChange, saving = false }) => {
  if (!isOpen || !grievance) return null;

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : '--');
  const fmtIncidentDate = (value) => {
    if (!value) return 'Not provided';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
  };
  const fmtConfidence = (value) => {
    if (value == null || value === '') return '--';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '--';
    return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(1)}%`;
  };

  const priorityBadgeMap = {
    low: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
    analyzing: 'bg-sky-100 text-sky-700',
    unavailable: 'bg-rose-100 text-rose-700',
  };

  const getPriorityBadge = (priority) => priorityBadgeMap[priority] || 'bg-gray-100 text-gray-800';
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

  const complainantName = grievance.isAnonymous
    ? 'Anonymous'
    : grievance.complainantName || grievance.complainantId?.name || '--';
  const complainantEmail = grievance.isAnonymous
    ? 'Not disclosed'
    : grievance.complainantEmail || grievance.complainantId?.email || '--';
  const complainantContact = grievance.isAnonymous
    ? 'Hidden for anonymous filing'
    : grievance.complainantId?.contact || grievance.complainantId?.phone || '--';
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
  const analysisStatus = hasOverride ? 'completed' : isPredefinedAiAnalysis(grievance.aiAnalysis) ? 'failed' : grievance.aiAnalysisStatus;
  const categoryLabel = effectiveAnalysis?.category?.label
    ? normalizeAiCategoryLabel(effectiveAnalysis.category.label)
    : (analysisStatus === 'pending' ? 'Analyzing' : analysisStatus === 'failed' ? 'Unavailable' : normalizeAiCategoryLabel(grievance.category || 'general', 'General'));
  const priorityLabel = effectiveAnalysis?.urgency?.label
    || (analysisStatus === 'pending' ? 'Analyzing' : analysisStatus === 'failed' ? 'Unavailable' : formatPriorityLabel(grievance.priority, 'N/A'));
  const incidentDate = fmtIncidentDate(grievance.incidentDate);
  const trackingId = grievance.referenceNumber || grievance.trackingId || '--';
  const sla = getGrievanceSlaStatus(grievance);
  const satisfactionRating = Number(grievance.resolutionSatisfactionRating || 0);
  const satisfactionLabel = SATISFACTION_LABELS[satisfactionRating] || '';
  const assignedHandlerLabel =
    grievance.assignedTo?.name ||
    (grievance.office
      ? `Default route: ${String(grievance.office).trim()}`
      : 'Unassigned');
  const canMarkUnderReview =
    currentUser?.role === 'superadmin' &&
    !grievance.archived &&
    grievance.status === 'pending' &&
    typeof onStatusChange === 'function';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-50 rounded-[28px] shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 px-8 py-7 flex items-start justify-between">
          <div className="text-left text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100/90">Case Review</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight">{grievance.subject || 'Grievance Details'}</h2>
            <p className="mt-3 text-sm text-blue-100">Tracking ID: {trackingId}</p>
          </div>
          <div className="flex items-center gap-3">
            {canMarkUnderReview && (
              <button
                type="button"
                onClick={() => onStatusChange('under_review')}
                disabled={saving}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
              >
                {saving ? 'Updating...' : 'Mark Under Review'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 bg-slate-100/70">
          <div className="px-8 py-6 space-y-6">
            <div className="space-y-4">
              <SectionBlock
                title="Case Overview"
                subtitle="Primary case details and routing information."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</p>
                    <div className="mt-3">
                      <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${getPriorityBadge(normalizePriorityLabel(priorityLabel))}`}>
                        {priorityLabel}
                      </span>
                    </div>
                  </div>

                  <InfoField label="Category" value={categoryLabel} />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">72-hour SLA</p>
                    <div className="mt-3">
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${sla.className}`}>
                        {sla.label}
                      </span>
                    </div>
                  </div>
                </div>

                <ConversationTranscript grievance={grievance} className="mt-4" />

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Original Description</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                    {getOriginalDescription(grievance) || '--'}
                  </p>
                </div>

                {hasDistinctProcessedDescription(grievance) && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Processed Description</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                      {getProcessedDescription(grievance)}
                    </p>
                  </div>
                )}

                {modelAnalysis || hasOverride ? (
                  <div className="mt-4 rounded-[26px] border border-sky-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_rgba(255,255,255,0.96)_55%)] p-5 shadow-[0_20px_55px_-34px_rgba(14,165,233,0.45)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">AI Analysis</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {hasOverride ? 'Admin override applied. Original AI output retained in history.' : 'Generated by the trained complaint-analysis models.'}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                        {hasOverride ? 'Admin Edited' : 'Model Complete'}
                      </span>
                    </div>

                    {hasOverride && grievance.aiAnalysisOverrideAt && (
                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Edited on {new Date(grievance.aiAnalysisOverrideAt).toLocaleString()}
                      </p>
                    )}

                    {effectiveAnalysis?.summary && (
                      <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Summary</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{effectiveAnalysis.summary}</p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-sky-100 bg-white/85 p-4 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Complaint Type</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{normalizeAiCategoryLabel(effectiveAnalysis?.category?.label || '--')}</p>
                        <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.category?.confidence)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-white/85 p-4 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Urgency Level</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{formatPriorityLabel(effectiveAnalysis?.urgency?.label, '--')}</p>
                        <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.urgency?.confidence)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Sentiment</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{effectiveAnalysis?.sentiment?.label || '--'}</p>
                        <p className="mt-2 text-xs text-slate-500">AI Confidence: {fmtConfidence(effectiveAnalysis?.sentiment?.confidence)}</p>
                      </div>
                    </div>
                  </div>
                ) : analysisStatus === 'pending' ? (
                  <div className="mt-4 rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(245,158,11,0.32)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">AI Analysis</p>
                    <p className="mt-3 text-sm font-medium text-amber-900">The trained models are still analyzing this complaint.</p>
                    <p className="mt-2 text-sm leading-6 text-amber-800">This panel will update automatically with complaint type, urgency level, summary, and sentiment.</p>
                  </div>
                ) : analysisStatus === 'failed' ? (
                <div className="mt-4 rounded-[26px] border border-rose-200 bg-[linear-gradient(135deg,rgba(251,113,133,0.14),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(244,63,94,0.26)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">AI Analysis</p>
                  <p className="mt-3 text-sm font-medium text-rose-900">{isPredefinedAiAnalysis(grievance.aiAnalysis) ? 'The saved result was rule-based, not a trained model prediction. Open Edit Grievance and reanalyze this case.' : 'The grievance was saved, but the AI analysis could not be generated yet.'}</p>
                  <p className="mt-2 text-sm leading-6 text-rose-800">Please verify that the local AI models and Python dependencies are available on the backend server.</p>
                  {grievance.aiAnalysisError && (
                    <div className="mt-4 rounded-2xl border border-rose-100 bg-white/85 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Error Detail</p>
                      <p className="mt-2 break-words font-mono text-xs leading-6 text-rose-900">{grievance.aiAnalysisError}</p>
                    </div>
                  )}
                </div>
                ) : null}

                <div className="mt-4">
                  <GrievanceStatusTracker
                    key={`${grievance._id}-${grievance.status}-${grievance.updatedAt || ''}-${grievance.inProgressAt || ''}-${grievance.underReviewAt || ''}-${grievance.departmentAssignedAt || ''}-${grievance.officeReceivedAt || ''}-${grievance.resolvedAt || ''}`}
                    grievance={grievance}
                    headingLabel="Status Tracking"
                  />
                </div>
              </SectionBlock>

              <SectionBlock
                title="Routing Snapshot"
                subtitle="Where this grievance is assigned and when the event happened."
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned Office</p>
                    <p className="mt-2 text-sm text-slate-900">{grievance.office || '--'}</p>
                    {grievance.department && (
                      <p className="mt-1 text-sm text-slate-500">{grievance.department}</p>
                    )}
                  </div>
                  <InfoField
                    label="Assigned Handler"
                    value={assignedHandlerLabel}
                    subtle={!grievance.assignedTo?.name}
                  />
                  <InfoField label="Incident Date" value={incidentDate} subtle={!grievance.incidentDate} />
                </div>
              </SectionBlock>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionBlock
                title="Complainant Information"
                subtitle="Identity and contact details available to reviewers."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InfoField label="Name" value={complainantName} />
                  <InfoField label="Email" value={complainantEmail} subtle={grievance.isAnonymous} />
                  <InfoField label="Contact" value={complainantContact} subtle={complainantContact === 'Hidden for anonymous filing'} />
                  <InfoField
                    label="Submission Type"
                    value={grievance.isAnonymous ? 'Anonymous grievance' : 'Filed with identity'}
                  />
                </div>
              </SectionBlock>

              <SectionBlock
                title="Timeline"
                subtitle="Important case milestones and activity dates."
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <InfoField label="Created" value={fmtDate(grievance.createdAt)} />
                  <InfoField label="Last Updated" value={fmtDate(grievance.updatedAt)} />
                  <InfoField
                    label="Resolved"
                    value={grievance.resolvedAt ? fmtDate(grievance.resolvedAt) : 'Not resolved yet'}
                    subtle={!grievance.resolvedAt}
                  />
                  {grievance.archivedAt ? (
                    <InfoField label="Archived" value={fmtDate(grievance.archivedAt)} />
                  ) : (
                    <InfoField label="Archived" value="Not archived" subtle />
                  )}
                </div>
              </SectionBlock>
            </div>

            {grievance.attachments?.length > 0 && (
              <SectionBlock
                title="Attachments"
                subtitle="Supporting files submitted with the grievance."
              >
                <div className="space-y-4">
                  {grievance.attachments.map((attachment, index) => (
                    <AttachmentPreviewCard
                      key={`${attachment.url || attachment.fileName || index}-${index}`}
                      attachment={attachment}
                      index={index}
                    />
                  ))}
                </div>
              </SectionBlock>
            )}

            {grievance.archiveReason && (
              <SectionBlock
                title="Archive Reason"
                subtitle="Reason recorded when the grievance was archived."
              >
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap break-words">{grievance.archiveReason}</p>
                </div>
              </SectionBlock>
            )}

            {grievance.resolutionNotes && (
              <SectionBlock
                title="Resolution Notes"
                subtitle="Office notes shared during final resolution."
              >
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="whitespace-pre-wrap break-words text-gray-900">{grievance.resolutionNotes}</p>
                </div>
              </SectionBlock>
            )}

            {grievance.status === 'resolved' && (
              <SectionBlock
                title="Complainant Satisfaction"
                subtitle="Feedback submitted by the complainant after resolution."
              >
                {satisfactionRating ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Rating</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {satisfactionRating} {'⭐'.repeat(satisfactionRating)}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">{satisfactionLabel}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Submitted</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {grievance.resolutionSatisfactionSubmittedAt
                            ? fmtDate(grievance.resolutionSatisfactionSubmittedAt)
                            : 'Recorded with no timestamp'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No satisfaction rating submitted yet.
                  </div>
                )}
              </SectionBlock>
            )}

            {/* Additional Details */}
            {grievance.notes && (
              <SectionBlock
                title="Notes"
                subtitle="Internal notes captured for this grievance."
              >
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap break-words">{grievance.notes}</p>
                </div>
              </SectionBlock>
            )}

            {hasFishboneContent(grievance.rootCauseAnalysis) && (
              <SectionBlock
                title="Fishbone Analysis"
                subtitle="Possible contributing factors identified before determining the root cause."
              >
                <FishboneAnalysisPanel rca={grievance.rootCauseAnalysis} />
              </SectionBlock>
            )}

            {hasRcaContent(grievance) && (
              <SectionBlock
                title="Root Cause Analysis"
                subtitle="Root cause details, resolution actions, and official grievance report download."
              >
                <RootCauseAnalysisView grievance={grievance} showFishbone={false} />
              </SectionBlock>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrievanceDetailsModal;

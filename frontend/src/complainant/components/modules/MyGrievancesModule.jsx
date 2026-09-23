import { useEffect, useState } from 'react';
import { axiosInstance } from '../../../services/authService';
import { useRealTimeGrievances } from '../../../hooks/useRealTime';
import GrievanceStatusTracker from './GrievanceStatusTracker';
import { formatGrievanceStatus } from '../../../utils/grievanceStatus';
import ComplainantRcaView from './ComplainantRcaView';
import { normalizeAiCategoryLabel } from '../../../utils/aiAnalysis';
import ConversationTranscript from '../../../components/ConversationTranscript';
import AttachmentPreviewCard from '../../../components/AttachmentPreviewCard';

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

const priorityBadge = (priority) => {
  const map = {
    low: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
    critical: 'bg-red-100 text-red-700',
    analyzing: 'bg-sky-100 text-sky-700',
    unavailable: 'bg-rose-100 text-rose-700',
  };
  return map[priority] || 'bg-gray-100 text-gray-800';
};

const fmtStatus = (value) => formatGrievanceStatus(value);
const fmtDate = (value) => (value ? new Date(value).toLocaleString() : '--');
const getOriginalDescription = (grievance) =>
  String(grievance?.originalDescription || grievance?.description || '').trim();
const getProcessedDescription = (grievance) =>
  String(grievance?.description || '').trim();
const hasDistinctProcessedDescription = (grievance) => {
  const original = getOriginalDescription(grievance);
  const processed = getProcessedDescription(grievance);
  return !!(original && processed && original !== processed);
};
const getDisplayPriority = (grievance) => {
  if (!grievance) {
    return '--';
  }

  if (grievance.aiAnalysisStatus === 'pending') {
    return 'Analyzing';
  }

  if (grievance.aiAnalysisStatus === 'failed') {
    return 'Unavailable';
  }

  return grievance.aiAnalysis?.urgency?.label || grievance.priority || '--';
};

const getPriorityBadgeTone = (grievance) => {
  const label = getDisplayPriority(grievance).toLowerCase();
  return priorityBadge(label);
};

const SATISFACTION_OPTIONS = [
  { value: 1, label: 'Very Dissatisfied' },
  { value: 2, label: 'Dissatisfied' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Satisfied' },
  { value: 5, label: 'Very Satisfied' },
];

const CASE_REVIEW_STEPS = [
  { id: 1, title: 'Case Progress', description: 'Status, transcript' },
  { id: 2, title: 'Grievance Information', description: 'Complaint and case details' },
  { id: 3, title: 'AI Analysis', description: 'Summary and insights' },
  { id: 4, title: 'Resolution / Outcome', description: 'Resolution and feedback' },
];

const DetailField = ({ label, value }) => (
  <div className="border-b border-slate-100 pb-3 last:border-b-0 md:border-b-0 md:pb-0">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-900">{value}</p>
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
            aria-current={isActive ? 'step' : undefined}
          >
            <span
              className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                isActive
                  ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                  : isComplete
                    ? 'border-sky-300 bg-white text-sky-700'
                    : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {step.id}
            </span>
            {index < CASE_REVIEW_STEPS.length - 1 && (
              <span className="absolute left-[2.1rem] top-[1.45rem] hidden h-px w-[calc(100%-1rem)] bg-sky-200 md:block" />
            )}
            <span className="relative z-10 min-w-0">
              <span className={`block truncate text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-700'}`}>
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

const AiAnalysisCard = ({ grievance }) => {
  if (!grievance) {
    return null;
  }

  if (grievance.aiAnalysis) {
    return (
      <div className="rounded-[26px] border border-sky-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_rgba(255,255,255,0.96)_55%)] p-5 shadow-[0_20px_55px_-34px_rgba(14,165,233,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">AI Analysis</p>
            <p className="mt-2 text-sm text-slate-600">Generated from your trained complaint-analysis models.</p>
          </div>
          <span className="inline-flex rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
            Model Complete
          </span>
        </div>

        {grievance.aiAnalysis.summary && (
          <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Summary</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {grievance.aiAnalysis.summary}
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-100 bg-white/85 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Complaint Type</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{normalizeAiCategoryLabel(grievance.aiAnalysis.category?.label || '--')}</p>
            <p className="mt-2 text-xs text-slate-500">AI Confidence {(Number(grievance.aiAnalysis.category?.confidence || 0) * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white/85 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Urgency Level</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{grievance.aiAnalysis.urgency?.label || '--'}</p>
            <p className="mt-2 text-xs text-slate-500">AI Confidence {(Number(grievance.aiAnalysis.urgency?.confidence || 0) * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Sentiment</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{grievance.aiAnalysis.sentiment?.label || '--'}</p>
            <p className="mt-2 text-xs text-slate-500">AI Confidence {(Number(grievance.aiAnalysis.sentiment?.confidence || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    );
  }

  if (grievance.aiAnalysisStatus === 'pending') {
    return (
      <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(245,158,11,0.32)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">AI Analysis</p>
        <p className="mt-3 text-sm font-medium text-amber-900">The trained models are still analyzing this complaint.</p>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Once processing finishes, this section will show the AI-generated complaint type, urgency level, summary, and sentiment.
        </p>
      </div>
    );
  }

  if (grievance.aiAnalysisStatus === 'failed') {
    return (
        <div className="rounded-[26px] border border-rose-200 bg-[linear-gradient(135deg,rgba(251,113,133,0.14),rgba(255,255,255,0.96))] p-5 shadow-[0_20px_55px_-34px_rgba(244,63,94,0.26)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">AI Analysis</p>
          <p className="mt-3 text-sm font-medium text-rose-900">The grievance was saved, but the AI analysis could not be generated yet.</p>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Please check whether the local model folders and Python AI dependencies are available on the backend server.
          </p>
          {grievance.aiAnalysisError && (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-white/85 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Error Detail</p>
              <p className="mt-2 break-words font-mono text-xs leading-6 text-rose-900">{grievance.aiAnalysisError}</p>
            </div>
          )}
        </div>
      );
  }

  return null;
};
const MyGrievancesModule = () => {
  const { latestUpdate } = useRealTimeGrievances();
  const [stats, setStats] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [caseReviewStep, setCaseReviewStep] = useState(1);

  const selectedGrievance = grievances.find((item) => item._id === selectedId) || grievances[0] || null;

  const loadStats = async () => {
    const response = await axiosInstance.get('/grievances/mine/stats');
    if (response.data?.success) {
      setStats(response.data.data);
    }
  };

  const loadGrievances = async (nextFilters = filters) => {
    const query = new URLSearchParams({
      page: String(nextFilters.page || 1),
      limit: String(nextFilters.limit || 10),
      search: nextFilters.search || '',
      status: nextFilters.status || '',
    });

    const response = await axiosInstance.get(`/grievances/mine?${query.toString()}`);
    if (response.data?.success) {
      const items = response.data.data || [];
      setGrievances(items);
      setPagination(response.data.pagination || pagination);

      if (!selectedId && items[0]) {
        setSelectedId(items[0]._id);
      } else if (selectedId && !items.find((item) => item._id === selectedId)) {
        setSelectedId(items[0]?._id || '');
      }
    }
  };

  const reloadAll = async (nextFilters = filters) => {
    try {
      setLoading(true);
      await Promise.all([loadStats(), loadGrievances(nextFilters)]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your grievances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!latestUpdate?._id) {
      return;
    }

    reloadAll(filters).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestUpdate?._id, latestUpdate?.updatedAt, latestUpdate?.aiAnalysisStatus]);

  useEffect(() => {
    setCaseReviewStep(1);
  }, [selectedId]);

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value, page: 1 };
    setFilters(next);
    loadGrievances(next).catch((err) => {
      setError(err.response?.data?.message || 'Failed to filter grievances');
    });
  };

  const handlePageChange = (page) => {
    const next = { ...filters, page };
    setFilters(next);
    loadGrievances(next).catch((err) => {
      setError(err.response?.data?.message || 'Failed to load page');
    });
  };

  const handleSatisfactionSubmit = async (rating) => {
    if (!selectedGrievance?._id || ratingSaving) {
      return;
    }

    try {
      setRatingSaving(true);
      setRatingError('');
      const response = await axiosInstance.put(`/grievances/${selectedGrievance._id}/satisfaction`, { rating });
      const updated = response.data?.data;

      if (response.data?.success && updated?._id) {
        setGrievances((current) =>
          current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item))
        );
        setSelectedId(updated._id);
      }
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to save satisfaction rating');
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 lg:p-5">
      <div className="mx-auto w-full max-w-[1680px] space-y-6">
        <div className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_20px_55px_-28px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:rounded-[28px] sm:p-6">
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">My Grievances</h2>
          <p className="mt-1 text-sm text-gray-600">Track the status of your submitted grievances and review case details.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Total', stats.total],
              ['Pending', stats.pending],
              ['In Progress', stats.inProgress],
              ['Resolved', stats.resolved],
              ['Rejected', stats.rejected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] sm:p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,2.15fr)]">
          <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)]">
            <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 p-4">
              <input
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search reference or subject"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              >
                <option value="">All Status</option>
                {['pending', 'under_review', 'assigned_to_department', 'in_progress', 'resolved', 'rejected', 'escalated'].map((status) => (
                  <option key={status} value={status}>{fmtStatus(status)}</option>
                ))}
              </select>
            </div>

            <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-200">
              {loading ? (
                <div className="p-6 text-center text-slate-500">Loading grievances...</div>
              ) : grievances.length === 0 ? (
                <div className="p-6 text-center text-slate-500">You have not submitted any grievances yet.</div>
              ) : (
                grievances.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setSelectedId(item._id)}
                    className={`w-full p-4 text-left transition ${selectedId === item._id ? 'bg-sky-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{item.referenceNumber}</p>
                        <p className="text-sm text-slate-700">{item.subject}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(item.status)}`}>
                        {fmtStatus(item.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPriorityBadgeTone(item)}`}>
                        {getDisplayPriority(item)}
                      </span>
                      <span className="text-xs text-slate-500">{fmtDate(item.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 p-4">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                {pagination.currentPage} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6">
            {!selectedGrievance ? (
              <div className="flex h-full items-center justify-center text-slate-500">Select a grievance to view its details.</div>
            ) : (
              <div className="space-y-5 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Case Overview</p>
                    <h3 className="mt-2 break-words text-xl font-bold text-slate-900 sm:text-2xl">{selectedGrievance.subject}</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedGrievance.referenceNumber}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${getPriorityBadgeTone(selectedGrievance)}`}>
                      {getDisplayPriority(selectedGrievance)}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadge(selectedGrievance.status)}`}>
                      {fmtStatus(selectedGrievance.status)}
                    </span>
                  </div>
                </div>

                <CaseReviewStepIndicator currentStep={caseReviewStep} onStepChange={setCaseReviewStep} />

                {caseReviewStep === 1 && (
                  <div className="space-y-4">
                    <GrievanceStatusTracker
                  key={`${selectedGrievance._id}-${selectedGrievance.status}-${selectedGrievance.updatedAt || ''}-${selectedGrievance.inProgressAt || ''}-${selectedGrievance.underReviewAt || ''}-${selectedGrievance.departmentAssignedAt || ''}-${selectedGrievance.officeReceivedAt || ''}-${selectedGrievance.resolvedAt || ''}`}
                  grievance={selectedGrievance}
                  collegeDisplay="acronym"
                  compact
                />

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
                    <section>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Original Description</p>
                      <div className="rounded-2xl bg-slate-50 p-4 whitespace-pre-line text-slate-800">
                        {getOriginalDescription(selectedGrievance) || '--'}
                      </div>
                    </section>

                    {hasDistinctProcessedDescription(selectedGrievance) && (
                      <section>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Processed Description</p>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 whitespace-pre-line text-slate-700">
                          {getProcessedDescription(selectedGrievance)}
                        </div>
                      </section>
                    )}

                    <section>
                      <p className="mb-3 text-sm font-semibold text-slate-700">Additional Information</p>
                      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                        <DetailField label="Incident Date" value={selectedGrievance.incidentDate ? fmtDate(selectedGrievance.incidentDate) : 'Not specified'} />
                        <DetailField label="Person Involved" value={selectedGrievance.personInvolved || 'Not specified'} />
                        <DetailField label="Office" value={selectedGrievance.office || 'Not specified'} />
                        <DetailField label="Department" value={selectedGrievance.department || 'Not specified'} />
                      </div>
                    </section>
                  </div>
                )}

                {caseReviewStep === 3 && (
                  <div className="space-y-5">
                    <AiAnalysisCard grievance={selectedGrievance} />

                    <section>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Attachments</p>
                      {selectedGrievance.attachments?.length > 0 ? (
                        <div className="space-y-3">
                          {selectedGrievance.attachments.map((attachment, index) => (
                            <AttachmentPreviewCard
                              key={`${attachment.url || attachment.fileName || index}-${index}`}
                              attachment={attachment}
                              index={index}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          No attachments were submitted with this grievance.
                        </p>
                      )}
                    </section>
                  </div>
                )}

                {caseReviewStep === 4 && (
                  <div className="space-y-5">
                    <section>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Current Status</p>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadge(selectedGrievance.status)}`}>
                          {fmtStatus(selectedGrievance.status)}
                        </span>
                        {selectedGrievance.status !== 'resolved' && (
                          <p className="text-sm leading-6 text-slate-600">
                            This grievance has not yet been resolved. Resolution information will appear here once the responsible office completes the case.
                          </p>
                        )}
                      </div>
                    </section>

                {selectedGrievance.resolutionNotes && (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-700">Resolution Notes</p>
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 whitespace-pre-line text-slate-800">
                      {selectedGrievance.resolutionNotes}
                    </div>
                  </div>
                )}

                {selectedGrievance.status === 'resolved' && (
                  <ComplainantRcaView grievance={selectedGrievance} />
                )}

                {selectedGrievance.status === 'resolved' && (
                  <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.98))] p-5 shadow-[0_18px_50px_-32px_rgba(245,158,11,0.28)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="text-left">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Satisfaction Scale After Resolution</p>
                        <h4 className="mt-2 text-lg font-semibold text-slate-900">How satisfied are you with the resolution?</h4>
                        <p className="mt-1 text-sm text-slate-600">Please rate the result of this resolved grievance from 1 to 5 stars.</p>
                      </div>
                      {selectedGrievance.resolutionSatisfactionSubmittedAt && (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Saved {fmtDate(selectedGrievance.resolutionSatisfactionSubmittedAt)}
                        </span>
                      )}
                    </div>

                    {ratingError && (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {ratingError}
                      </div>
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {SATISFACTION_OPTIONS.map((option) => {
                        const isSelected = selectedGrievance.resolutionSatisfactionRating === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSatisfactionSubmit(option.value)}
                            disabled={ratingSaving}
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              isSelected
                                ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <p className="text-sm font-semibold">{option.value} {'⭐'.repeat(option.value)}</p>
                            <p className="mt-2 text-sm">{option.label}</p>
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                      {selectedGrievance.resolutionSatisfactionRating
                        ? 'You can click another rating if you want to update your response.'
                        : 'Choose one satisfaction score to record your feedback.'}
                    </p>
                  </div>
                )}

                  </div>
                )}

                <CaseReviewPager currentStep={caseReviewStep} onStepChange={setCaseReviewStep} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyGrievancesModule;

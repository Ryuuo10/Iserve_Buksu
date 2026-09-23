import { useEffect, useState } from 'react';

const TRACKER_STEPS = [
  { key: 'pending', title: 'Pending', icon: 'document' },
  { key: 'underReview', title: 'Under Review', icon: 'search' },
  { key: 'assigned', title: 'Assigned to Department', icon: 'building' },
  { key: 'receivedPending', title: 'Received in Pending', icon: 'building' },
  { key: 'inProgress', title: 'In Progress', icon: 'spinner' },
  { key: 'resolved', title: 'Resolved', icon: 'spark' },
];

const toDate = (value) => (value ? new Date(value) : null);

const formatStepTimestamp = (value) => {
  if (!value) {
    return 'Waiting';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const resolveTrackerTimes = (grievance) => {
  const submittedAt = grievance.createdAt || null;
  const reviewStartedAt = grievance.underReviewAt || null;
  const assignedAt = grievance.departmentAssignedAt || grievance.assignedAt || null;
  const inProgressAt = grievance.inProgressAt || null;
  const escalatedAt = grievance.escalatedAt || null;
  const resolvedAt = grievance.resolvedAt || null;
  const hasRoutingData = Boolean(grievance.assignedTo || grievance.department || grievance.office);
  const derivedReviewStartedAt =
    reviewStartedAt || (grievance.status === 'pending' ? null : grievance.updatedAt || assignedAt || resolvedAt || submittedAt);
  const routedAt =
    assignedAt || (hasRoutingData && grievance.status !== 'pending' ? grievance.updatedAt || derivedReviewStartedAt : null);
  const receivedPendingAt =
    grievance.officeReceivedAt || grievance.departmentAssignedAt || grievance.assignedAt || null;
  const workStartedAt =
    ['in_progress', 'resolved', 'escalated'].includes(grievance.status) || resolvedAt
      ? inProgressAt || escalatedAt || grievance.updatedAt || resolvedAt || routedAt
      : null;

  return {
    pending: submittedAt,
    underReview: derivedReviewStartedAt,
    assigned: routedAt,
    receivedPending: receivedPendingAt,
    inProgress: workStartedAt,
    resolved: resolvedAt || null,
  };
};

const resolveCurrentStepIndex = (grievance, trackerTimes) => {
  if (grievance.status === 'resolved' || trackerTimes.resolved) {
    return 5;
  }

  if (grievance.status === 'rejected') {
    if (trackerTimes.inProgress) {
      return 4;
    }

    if (trackerTimes.receivedPending) {
      return 3;
    }

    if (trackerTimes.assigned) {
      return 2;
    }

    return 1;
  }

  if (grievance.status === 'in_progress' || grievance.status === 'escalated') {
    return 4;
  }

  if (grievance.status === 'assigned_to_department') {
    return 3;
  }

  if (trackerTimes.receivedPending) {
    return 3;
  }

  if (trackerTimes.assigned) {
    return 2;
  }

  if (grievance.status === 'under_review') {
    return 1;
  }

  return 0;
};

const resolveStatusCopy = (grievance) => {
  if (grievance.status === 'resolved') {
    return {
      heading: 'Resolution completed',
      body: 'The grievance has been resolved after the office completed its RCA workflow.',
      tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }

  if (grievance.status === 'rejected') {
    return {
      heading: 'Flow paused',
      body: 'This grievance was marked as rejected, so the standard resolution flow stopped before closure.',
      tone: 'bg-rose-50 text-rose-800 border-rose-200',
    };
  }

  if (grievance.status === 'escalated') {
    return {
      heading: 'Escalated for further handling',
      body: 'The grievance remains active and is being handled with additional review.',
      tone: 'bg-violet-50 text-violet-800 border-violet-200',
    };
  }

  if (grievance.status === 'assigned_to_department') {
    return {
      heading: 'Received in pending',
      body: 'The grievance was already routed to the responsible office and is waiting for office action.',
      tone: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    };
  }

  if (grievance.status === 'in_progress') {
    return {
      heading: 'Work in progress',
      body: 'The grievance is already assigned and currently being acted on by the responsible office.',
      tone: 'bg-sky-50 text-sky-800 border-sky-200',
    };
  }

  if (grievance.status === 'under_review') {
    return {
      heading: 'Under review',
      body: 'The grievance is under review while the submitted details are being validated.',
      tone: 'bg-blue-50 text-blue-800 border-blue-200',
    };
  }

  return {
    heading: 'Submission received',
    body: 'The grievance was submitted successfully and is waiting for the review process to start.',
    tone: 'bg-slate-50 text-slate-700 border-slate-200',
  };
};

const StepIcon = ({ icon, state }) => {
  const iconClasses =
    state === 'current'
      ? 'text-white'
      : state === 'completed'
        ? 'text-emerald-600'
        : 'text-slate-400';

  if (state === 'completed') {
    return (
      <svg viewBox="0 0 24 24" className={`h-4 w-4 ${iconClasses}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13.2 9.2 17 19 7.5" />
      </svg>
    );
  }

  const iconMap = {
    document: <path d="M9 4.5h5l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V6a1.5 1.5 0 0 1 1.5-1.5Z M14 4.5V8h3" />,
    search: (
      <>
        <circle cx="11" cy="11" r="4.5" />
        <path d="m16 16 2.8 2.8" />
      </>
    ),
    building: (
      <>
        <path d="M8 20V8.5A1.5 1.5 0 0 1 9.5 7h5A1.5 1.5 0 0 1 16 8.5V20" />
        <path d="M5 20h14" />
        <path d="M10 10.5h.01M14 10.5h.01M10 14h.01M14 14h.01" />
      </>
    ),
    spinner: (
      <>
        <path d="M12 5.5a6.5 6.5 0 1 1-6.2 8.5" />
        <path d="M5.5 12H3.8" />
      </>
    ),
    spark: (
      <>
        <path d="m12 5 1.4 3.6L17 10l-3.6 1.4L12 15l-1.4-3.6L7 10l3.6-1.4L12 5Z" />
      </>
    ),
    archive: (
      <>
        <path d="M5 7.5h14v2.2A1.3 1.3 0 0 1 17.7 11H6.3A1.3 1.3 0 0 1 5 9.7V7.5Z" />
        <path d="M6.5 11v6.2A1.3 1.3 0 0 0 7.8 18.5h8.4a1.3 1.3 0 0 0 1.3-1.3V11" />
        <path d="M9.5 5.5h5" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${iconClasses}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconMap[icon]}
    </svg>
  );
};

const GrievanceStatusTracker = ({ grievance, headingLabel = 'Grievance Tracking', compact = false }) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const trackerTimes = resolveTrackerTimes(grievance);
  const currentStepIndex = resolveCurrentStepIndex(grievance, trackerTimes);
  const currentStep = TRACKER_STEPS[currentStepIndex];
  const statusCopy = resolveStatusCopy(grievance);
  const progressPercent = (currentStepIndex / (TRACKER_STEPS.length - 1)) * 100;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnimatedProgress(progressPercent);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [grievance._id, progressPercent]);

  return (
    <section className={`border border-slate-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.28)] ${
      compact ? 'rounded-2xl p-4' : 'rounded-[28px] p-5 sm:p-6'
    }`}>
      <div className={`flex flex-wrap items-start justify-between ${compact ? 'gap-3' : 'gap-4'}`}>
        <div className="text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{headingLabel}</p>
          <h4 className={`${compact ? 'mt-1 text-base' : 'mt-2 text-xl'} font-semibold text-slate-900`}>Current stage: {currentStep.title}</h4>
        </div>

        <div className={`${compact ? 'max-w-sm rounded-xl px-3 py-2 text-xs' : 'max-w-md rounded-2xl px-4 py-3 text-sm'} border ${statusCopy.tone}`}>
          <p className="font-semibold">{statusCopy.heading}</p>
          <p className={`${compact ? 'mt-0.5 leading-5' : 'mt-1 leading-6'}`}>{statusCopy.body}</p>
        </div>
      </div>

      {compact && (
        <div className="mt-4 space-y-0 sm:hidden">
          {TRACKER_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const state = isCompleted ? 'completed' : isCurrent ? 'current' : 'pending';

            const iconWrapClasses = isCompleted
              ? 'border-emerald-200 bg-emerald-50'
              : isCurrent
                ? 'border-sky-600 bg-sky-600 shadow-[0_0_0_5px_rgba(14,165,233,0.14)]'
                : 'border-slate-300 bg-white';
            const titleClasses = isCurrent ? 'text-slate-900' : isCompleted ? 'text-emerald-700' : 'text-slate-500';
            const lineClasses = isCompleted ? 'bg-emerald-300' : 'bg-slate-200';

            return (
              <div key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                {index < TRACKER_STEPS.length - 1 && (
                  <span className={`absolute left-[18px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${lineClasses}`} />
                )}

                <div className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${iconWrapClasses}`}>
                  <StepIcon icon={step.icon} state={state} />
                </div>

                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-left">
                  <p className={`text-sm font-semibold leading-5 ${titleClasses}`}>{step.title}</p>
                  <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">
                    {formatStepTimestamp(trackerTimes[step.key])}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={`${compact ? 'mt-4 hidden overflow-visible pb-0 sm:block' : 'mt-6 overflow-x-auto pb-2'}`}>
        <div className={`flex items-start ${compact ? 'min-w-0' : 'min-w-[920px]'}`}>
          {TRACKER_STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const state = isCompleted ? 'completed' : isCurrent ? 'current' : 'pending';
            const connectorFill = index < currentStepIndex ? '100%' : '0%';

            const iconWrapClasses = isCompleted
              ? 'border-emerald-200 bg-emerald-50'
              : isCurrent
                ? 'border-sky-600 bg-sky-600 shadow-[0_0_0_6px_rgba(14,165,233,0.15)]'
                : 'border-slate-300 bg-white';
            const titleClasses = isCurrent ? 'text-slate-900' : isCompleted ? 'text-emerald-700' : 'text-slate-500';

            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-start">
                <div className={`${compact ? 'min-w-0 flex-1 px-1' : 'w-36 flex-none sm:w-40'} text-center`}>
                  <div className={`mx-auto flex items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    compact ? 'h-9 w-9' : 'h-12 w-12'
                  } ${iconWrapClasses}`}>
                    <StepIcon icon={step.icon} state={state} />
                  </div>
                  <p className={`${compact ? 'mt-2 text-xs leading-4' : 'mt-4 text-sm leading-5'} font-semibold transition-colors duration-500 ${titleClasses}`}>{step.title}</p>
                  <p className={`${compact ? 'mt-1 text-[11px] leading-4' : 'mt-2 text-xs leading-5'} text-slate-400`}>{formatStepTimestamp(trackerTimes[step.key])}</p>
                </div>

                {index < TRACKER_STEPS.length - 1 && (
                  <div className={`${compact ? 'mt-4 px-0.5' : 'mt-5 px-2'} min-w-0 flex-1`}>
                    <div className={`${compact ? 'h-1' : 'h-1.5'} rounded-full bg-slate-200`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700 ease-out"
                        style={{ width: animatedProgress >= ((index + 1) / (TRACKER_STEPS.length - 1)) * 100 ? '100%' : connectorFill }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${compact ? 'mt-3 rounded-xl p-3 text-xs' : 'mt-4 rounded-2xl p-4 text-sm'} grid gap-3 bg-slate-50 text-slate-600 sm:grid-cols-2`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Filed</p>
          <p className="mt-1 font-medium text-slate-900">{formatStepTimestamp(toDate(grievance.createdAt))}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest update</p>
          <p className="mt-1 font-medium text-slate-900">{formatStepTimestamp(toDate(grievance.updatedAt))}</p>
        </div>
      </div>
    </section>
  );
};

export default GrievanceStatusTracker;

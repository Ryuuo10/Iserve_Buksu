export const GRIEVANCE_SLA_HOURS = 72;
export const GRIEVANCE_SLA_APPROACHING_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

const parseTime = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
};

const formatHours = (hours) => {
  const normalized = Math.max(0, Number(hours) || 0);
  const rounded = normalized >= 10 ? Math.round(normalized) : Math.round(normalized * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const getGrievanceSlaStatus = (grievance, now = Date.now()) => {
  const createdAt = parseTime(grievance?.createdAt);

  if (!createdAt) {
    return {
      state: 'unknown',
      label: 'SLA unavailable',
      badgeLabel: 'SLA unavailable',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  const deadline = createdAt + GRIEVANCE_SLA_HOURS * HOUR_MS;
  const resolvedAt = parseTime(grievance?.resolvedAt);
  const isResolved = grievance?.status === 'resolved' && resolvedAt;
  const comparisonTime = isResolved ? resolvedAt : now;
  const elapsedHours = (comparisonTime - createdAt) / HOUR_MS;

  if (isResolved) {
    if (elapsedHours <= GRIEVANCE_SLA_HOURS) {
      return {
        state: 'resolved_on_time',
        label: `Resolved in ${formatHours(elapsedHours)} hours`,
        badgeLabel: `Resolved in ${formatHours(elapsedHours)}h`,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    return {
      state: 'resolved_late',
      label: `Resolved late by ${formatHours(elapsedHours - GRIEVANCE_SLA_HOURS)} hours`,
      badgeLabel: `Resolved late by ${formatHours(elapsedHours - GRIEVANCE_SLA_HOURS)}h`,
      className: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }

  if (now >= deadline) {
    const overdueHours = formatHours((now - deadline) / HOUR_MS);

    return {
      state: 'overdue',
      label: `Overdue by ${overdueHours} hours`,
      badgeLabel: `OVERDUE by ${overdueHours}h`,
      className: 'bg-white text-rose-700 border-rose-300',
    };
  }

  const remainingHours = (deadline - now) / HOUR_MS;
  if (remainingHours <= GRIEVANCE_SLA_APPROACHING_HOURS) {
    return {
      state: 'approaching_sla',
      label: `Approaching SLA: due in ${formatHours(remainingHours)} hours`,
      badgeLabel: 'Approaching SLA',
      className: 'bg-amber-50 text-amber-800 border-amber-300',
    };
  }

  return {
    state: 'within_sla',
    label: `Within SLA: due in ${formatHours(remainingHours)} hours`,
    badgeLabel: 'Within SLA',
    className: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  };
};

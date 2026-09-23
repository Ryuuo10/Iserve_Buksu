import { useCallback, useEffect, useState } from 'react';
import { axiosInstance } from '../../../services/authService';
import { useRealTimeGrievances } from '../../../hooks/useRealTime';
import { getOfficePreferences } from '../../utils/preferences';

const OFFICE_SELECTED_GRIEVANCE_KEY = 'office_dashboard_selected_grievance_id';
const PRIORITY_SECTIONS = [
  {
    id: 'critical',
    label: 'Critical',
    emptyLabel: 'No critical issues',
    accent: 'text-red-700',
    countClass: 'bg-red-100 text-red-700',
    dotClass: 'bg-red-500',
    sectionClass: 'border-red-200 bg-red-50/70',
    hoverClass: 'hover:bg-red-100/80',
  },
  {
    id: 'high',
    label: 'High',
    emptyLabel: 'No high priority issues',
    accent: 'text-orange-700',
    countClass: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
    sectionClass: 'border-orange-200 bg-orange-50/60',
    hoverClass: 'hover:bg-orange-100/70',
  },
  {
    id: 'medium',
    label: 'Medium',
    emptyLabel: 'No medium priority issues',
    accent: 'text-amber-700',
    countClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500',
    sectionClass: 'border-amber-200 bg-amber-50/50',
    hoverClass: 'hover:bg-amber-100/70',
  },
  {
    id: 'low',
    label: 'Low',
    emptyLabel: 'No low priority issues',
    accent: 'text-emerald-700',
    countClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    sectionClass: 'border-emerald-200 bg-emerald-50/50',
    hoverClass: 'hover:bg-emerald-100/70',
  },
];

const formatStatus = (value) =>
  String(value || '')
    .split('_')
    .filter(Boolean)
    .join(' ');

const statusClasses = {
  pending: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  assigned_to_department: 'bg-cyan-100 text-cyan-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  escalated: 'bg-purple-100 text-purple-800',
};

const priorityBadgeClasses = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

const ChevronIcon = ({ expanded }) => (
  <svg
    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export const DashboardModule = ({ onNavigate }) => {
  const { latestUpdate } = useRealTimeGrievances();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(() => getOfficePreferences());
  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    high: false,
    medium: false,
    low: false,
  });

  const fetchDashboard = useCallback(async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }

      const response = await axiosInstance.get('/offices/grievances/dashboard');
      if (response.data?.success) {
        setDashboard(response.data.data);
        setError('');
      } else {
        setError('Unable to load dashboard data.');
      }
    } catch (fetchError) {
      console.error('Failed to fetch office dashboard:', fetchError);
      setError(fetchError.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handlePreferencesUpdated = (event) => {
      if (event.detail) {
        setPreferences(event.detail);
      }
    };

    window.addEventListener('office-system-settings-updated', handlePreferencesUpdated);
    return () => window.removeEventListener('office-system-settings-updated', handlePreferencesUpdated);
  }, []);

  useEffect(() => {
    fetchDashboard();

    const refreshSeconds = Number(preferences.dashboardRefreshSeconds || 0);
    const interval = refreshSeconds > 0
      ? setInterval(() => fetchDashboard(true), refreshSeconds * 1000)
      : null;

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchDashboard, preferences.dashboardRefreshSeconds]);

  useEffect(() => {
    if (!latestUpdate?._id) {
      return;
    }

    fetchDashboard(true);
  }, [fetchDashboard, latestUpdate?._id, latestUpdate?.updatedAt, latestUpdate?.status]);

  const summary = dashboard?.summary || {
    total: 0,
    pending: 0,
    inProgress: 0,
    escalated: 0,
    resolvedToday: 0,
    resolvedThisWeek: 0,
    resolvedTotal: 0,
    avgResolutionHours: 0,
  };

  const recentGrievances = dashboard?.recentGrievances || [];
  const priorityQueue = dashboard?.priorityQueue || {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  const cards = [
    {
      title: 'Pending Grievances',
      value: summary.pending,
      note: `${summary.total} assigned overall`,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      ),
    },
    {
      title: 'Resolved Today',
      value: summary.resolvedToday,
      note: `${summary.resolvedThisWeek} resolved this week`,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
    {
      title: 'In Progress',
      value: summary.inProgress,
      note: `${summary.escalated} escalated for attention`,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      ),
    },
    {
      title: 'Avg. Resolution Time',
      value: Number(summary.avgResolutionHours || 0).toFixed(1),
      note: `${summary.resolvedTotal} resolved overall`,
      suffix: 'hours',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
  ];

  const openGrievanceFromDashboard = useCallback((grievanceId) => {
    if (!grievanceId) {
      return;
    }

    localStorage.setItem(OFFICE_SELECTED_GRIEVANCE_KEY, grievanceId);
    onNavigate?.('grievances');
  }, [onNavigate]);

  const toggleSection = (priorityId) => {
    setExpandedSections((current) => ({
      ...current,
      [priorityId]: !current[priorityId],
    }));
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold text-gray-900">Office Dashboard</h1>
            <p className="text-gray-600">Live grievance activity assigned to your office account</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '--' : card.value}
                  {card.suffix ? <span className="ml-2 text-base font-semibold text-gray-500">{card.suffix}</span> : null}
                </p>
                <p className="text-sm text-gray-500 mt-1">{loading ? 'Loading...' : card.note}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <svg className={`w-6 h-6 ${card.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {card.icon}
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Grievances</h3>
            <button
              type="button"
              onClick={() => onNavigate?.('grievances')}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Open queue
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse h-20"></div>
              ))}
            </div>
          ) : recentGrievances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <p className="text-base font-semibold text-gray-900">No assigned grievances yet</p>
              <p className="mt-2 text-sm text-gray-500">Recent case activity will appear here once grievances are assigned.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentGrievances.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openGrievanceFromDashboard(item.id)}
                  className="w-full rounded-xl bg-gray-50 p-4 text-left transition-colors duration-200 hover:bg-gray-100"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {item.subject} #{item.referenceNumber}
                        </p>
                        <p className="text-sm text-gray-600">{item.relativeTime}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusClasses[item.status] || 'bg-gray-100 text-gray-700'}`}>
                      {formatStatus(item.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-500">Urgency Queue</p>
              <h3 className="mt-2 text-2xl font-bold text-gray-900">Priority Queue</h3>
              <p className="mt-2 text-sm text-gray-600">
                Review unresolved grievances by urgency so the office can handle the most critical cases first.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('grievances')}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Open queue
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-20 rounded-2xl border border-gray-200 bg-gray-50 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {PRIORITY_SECTIONS.map((section) => {
                const items = priorityQueue[section.id] || [];
                const isExpanded = expandedSections[section.id];

                return (
                  <div key={section.id} className={`rounded-2xl border ${section.sectionClass}`}>
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${section.dotClass}`}></span>
                        <div>
                          <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${section.accent}`}>
                            {section.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {items.length === 1 ? '1 active grievance' : `${items.length} active grievances`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${section.countClass}`}>
                          {items.length}
                        </span>
                        <ChevronIcon expanded={isExpanded} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/80 px-3 pb-3 pt-2">
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-white bg-white/70 px-4 py-5 text-sm text-gray-500">
                            {section.emptyLabel}
                          </div>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => openGrievanceFromDashboard(item.id)}
                                className={`w-full rounded-xl border border-white/80 bg-white/80 px-4 py-3 text-left transition-colors ${section.hoverClass}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900">{item.subject}</p>
                                    <p className="mt-1 text-xs font-medium text-gray-500">#{item.referenceNumber}</p>
                                  </div>
                                  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${priorityBadgeClasses[section.id]}`}>
                                    {section.label}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClasses[item.status] || 'bg-gray-100 text-gray-700'}`}>
                                    {formatStatus(item.status)}
                                  </span>
                                  <span className="text-[11px] text-gray-500">{item.relativeTime}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

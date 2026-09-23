import { useState, useEffect } from 'react';
import axios from 'axios';
import authService from '../../../services/authService';
import API_BASE_URL from '../../../config/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { canAccessAdminTab } from '../../../utils/adminPermissions';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const fmt = (v) => (v == null || v === '' ? '--' : typeof v === 'number' ? v.toLocaleString() : v);
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

const DashboardModule = ({ onNavigate }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState('month');

  /* ── grievance overview (will be populated when API is wired) ── */
  const [overview, setOverview] = useState({
    totalGrievances: null,
    pendingReview: null,
    rejectedCases: null,
    resolvedThisWeek: null,
    resolutionRate: null,
  });
  const [trendData, setTrendData] = useState([]);
  const [trendSets, setTrendSets] = useState({ monthly: [], weekly: [] });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [priorityQueue, setPriorityQueue] = useState({
    critical: [],
    high: [],
    medium: [],
    low: [],
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    critical: true,
    high: false,
    medium: false,
    low: false,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const token = authService.getToken();
        const profileRes = await authService.getProfile();
        const nextUser = profileRes?.user || null;
        const canSeeUsers = canAccessAdminTab(nextUser, 'users');
        const canSeeDashboard = canAccessAdminTab(nextUser, 'dashboard');

        const [statsRes, grievanceRes] = await Promise.all([
          token && canSeeUsers
            ? axios
                .get(`${API_BASE_URL}/admin/complainants/stats`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                .then((r) => r.data)
                .catch(() => null)
            : Promise.resolve(null),

          /* ── Grievance dashboard data ── */
          token && canSeeDashboard
            ? axios
                .get(`${API_BASE_URL}/admin/grievances/dashboard`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                .then((r) => r.data)
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!mounted) return;
        if (profileRes?.success) setUserInfo(profileRes.user);
        if (statsRes?.success && statsRes.data) setUserStats(statsRes.data);
        
        // Set grievance data
        if (grievanceRes?.success && grievanceRes.data) {
          setOverview(grievanceRes.data.overview);
          setCategoryBreakdown(grievanceRes.data.categoryBreakdown);
          setPriorityQueue(grievanceRes.data.priorityQueue);
          setRecentActivity(grievanceRes.data.recentActivity);
          const nextTrendSets = {
            monthly: grievanceRes.data.trendData?.monthly || [],
            weekly: grievanceRes.data.trendData?.weekly || [],
          };
          setTrendSets(nextTrendSets);
          setTrendData(nextTrendSets.monthly);
        }
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  /* ── Effect to handle chart filter changes ── */
  useEffect(() => {
    setTrendData(chartFilter === 'week' ? trendSets.weekly : trendSets.monthly);
  }, [chartFilter, trendSets]);

  /* ── derived values ── */
  const resolutionRate = overview.resolutionRate ?? '--';

  /* ── Generate default monthly labels (last 6 months) when no API data ── */
  const defaultMonthlyTrend = (() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({ label: `${months[d.getMonth()]} ${d.getFullYear()}`, filed: 0, resolved: 0 });
    }
    return result;
  })();

  /* ── Generate default weekly labels (last 6 weeks) ── */
  const defaultWeeklyTrend = (() => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const month = d.toLocaleString('default', { month: 'short' });
      result.push({ label: `${month} ${d.getDate()}`, filed: 0, resolved: 0 });
    }
    return result;
  })();


  let chartData = [];
  if (chartFilter === 'month') {
    chartData = trendData.length ? trendData : defaultMonthlyTrend;
  } else {
    chartData = trendData.length ? trendData : defaultWeeklyTrend;
  }
  const hasRealTrendData = chartData.some(d => (d.filed && d.filed > 0) || (d.resolved && d.resolved > 0));

  /* ── Chart.js config ── */
  const chartJsData = {
    labels: chartData.map((d) => d.label || d.name),
    datasets: [
      {
        label: 'Filed',
        data: chartData.map((d) => d.filed),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 2.5,
      },
      {
        label: 'Resolved',
        data: chartData.map((d) => d.resolved),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 2.5,
      },
    ],
  };

  const chartJsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          labelColor: (ctx) => ({
            borderColor: ctx.dataset.borderColor,
            backgroundColor: ctx.dataset.borderColor,
            borderRadius: 4,
          }),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f3f4f6', drawBorder: false },
        ticks: { color: '#9ca3af', font: { size: 11 }, precision: 0 },
      },
    },
  };

  const maxCatPct = Math.max(...categoryBreakdown.map((c) => c.percentage), 1);

  /* ── quick-nav items ── */
  const navItems = [
    { id: 'grievances', label: 'Grievance queue', desc: 'Review pending, rejected, and active cases', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', iconCls: 'bg-blue-100 text-blue-600', hoverCls: 'hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100' },
    { id: 'analytics', label: 'Analytics', desc: 'Trends, workload, and resolution metrics', icon: 'M9 17v-6m4 6V7m4 10v-4', iconCls: 'bg-cyan-100 text-cyan-600', hoverCls: 'hover:bg-cyan-50 hover:border-cyan-200 active:bg-cyan-100' },
    { id: 'users', label: 'User management', desc: 'Complainant accounts and access', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', iconCls: 'bg-emerald-100 text-emerald-600', hoverCls: 'hover:bg-emerald-50 hover:border-emerald-200 active:bg-emerald-100' },
    { id: 'offices', label: 'Offices', desc: 'Routing offices and handler setup', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', iconCls: 'bg-amber-100 text-amber-600', hoverCls: 'hover:bg-amber-50 hover:border-amber-200 active:bg-amber-100' },
  ].filter((item) => canAccessAdminTab(userInfo, item.id));
  const canViewGrievances = canAccessAdminTab(userInfo, 'grievances');
  const canViewUsers = canAccessAdminTab(userInfo, 'users');

  /* ── priority helpers ── */
  const toggleSection = (priorityId) => {
    setExpandedSections((current) => ({
      ...current,
      [priorityId]: !current[priorityId],
    }));
  };

  /* ── Skeleton placeholder ── */
  const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <section className="rounded-2xl border border-gray-200 bg-white px-8 py-7 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {loading ? (
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
          ) : (
            <div className="text-left">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome{userInfo?.name ? `, ${userInfo.name}` : ''}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Grievance operations overview
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {userInfo?.email && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-600">{userInfo.email}</span>
                )}
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-600">
                  {(userInfo?.role || 'superadmin').replace('_', ' ').toUpperCase()}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-600">
                  {userInfo?.isVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          )}

          {/* Mini summary pills */}
          <div className="flex gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center">
              <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(overview.rejectedCases)}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center">
              <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Resolution</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{resolutionRate}{typeof resolutionRate === 'number' ? '%' : ''}</p>
            </div>
            {canViewUsers && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center">
                <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Users</p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(userStats?.total)}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total grievances', value: fmt(overview.totalGrievances), sub: 'All time', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', iconCls: 'bg-blue-100 text-blue-600' },
          { label: 'Pending review', value: fmt(overview.pendingReview), sub: 'Awaiting action', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', iconCls: 'bg-amber-100 text-amber-600' },
          { label: 'Total rejected', value: fmt(overview.rejectedCases), sub: 'Marked as rejected', icon: 'M6 18L18 6M6 6l12 12', iconCls: 'bg-rose-100 text-rose-600' },
          { label: 'Resolved this week', value: fmt(overview.resolvedThisWeek), sub: 'Last 7 days', icon: 'M5 13l4 4L19 7', iconCls: 'bg-emerald-100 text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
                <p className="mt-1 text-xs text-gray-400">{s.sub}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconCls}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Chart + Category breakdown ── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Trend chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between border-b border-gray-100 pb-4">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{chartFilter === 'month' ? 'Monthly' : 'Weekly'} trend</p>
              <h3 className="text-lg font-bold text-gray-900">Intake vs. resolution</h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Filter toggle */}
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {['month', 'week'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setChartFilter(f)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      chartFilter === f
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f === 'month' ? 'Month' : 'Week'}
                  </button>
                ))}
              </div>
              {/* Legend */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Filed</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Resolved</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-gray-50 px-3 py-4" style={{ height: 260 }}>
            <Line data={chartJsData} options={chartJsOptions} />
            {!hasRealTrendData && (
              <p className="mt-2 text-center text-xs text-gray-400">Chart will populate when grievance data is available</p>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="border-b border-gray-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Categories</p>
            <h3 className="text-lg font-bold text-gray-900">Grievance distribution</h3>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="mt-6 flex h-48 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
              No category data yet
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{cat.percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-gray-900" style={{ width: `${(cat.percentage / maxCatPct) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Priority queue + sidebar (nav + platform stats) ── */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Priority queue */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Priority queue</p>
              <h3 className="text-lg font-bold text-gray-900">Cases needing attention</h3>
            </div>
            {canViewGrievances && (
              <button
                type="button"
                onClick={() => onNavigate?.('grievances')}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100"
              >
                View all
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
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
                          {items.slice(0, 6).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onNavigate?.('grievances')}
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
        </div>

        {/* Right column: quick nav + platform stats */}
        <div className="space-y-6">
          {/* Quick navigation */}
          {navItems.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Quick navigation</p>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Jump to module</h3>
              <div className="grid gap-2">
                {navItems.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onNavigate?.(n.id)}
                    className={`flex items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition-colors ${n.hoverCls}`}
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${n.iconCls}`}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{n.label}</p>
                      <p className="text-xs text-gray-400">{n.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {canViewUsers && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Platform</p>
              <h3 className="text-lg font-bold text-gray-900 mb-4">User statistics</h3>
              <div className="space-y-3">
                {[
                  { label: 'Registered users', value: fmt(userStats?.total), cls: 'bg-blue-50 text-blue-600' },
                  { label: 'Active accounts', value: fmt(userStats?.active), cls: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Inactive accounts', value: fmt(userStats?.inactive), cls: 'bg-amber-50 text-amber-600' },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center justify-between rounded-lg px-4 py-3 ${s.cls}`}>
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-lg font-bold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent updates</h3>
            {recentActivity.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardModule;

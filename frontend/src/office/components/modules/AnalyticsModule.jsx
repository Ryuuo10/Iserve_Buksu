import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { axiosInstance } from '../../../services/authService';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

export const AnalyticsModule = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axiosInstance.get('/offices/grievances/analytics');
        if (response.data?.success) {
          setAnalytics(response.data.data);
          setError('');
        } else {
          setError('Unable to load analytics.');
        }
      } catch (fetchError) {
        console.error('Failed to fetch office analytics:', fetchError);
        setError(fetchError.response?.data?.message || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const summary = analytics?.summary || {
    totalCases: 0,
    resolved: 0,
    pending: 0,
    inProgress: 0,
    escalated: 0,
    avgResolutionHours: 0,
    resolutionRate: 0,
  };

  const monthlyTrend = analytics?.monthlyTrend || [];
  const avgResolutionHours = summary.avgResolutionHours || 0;
  const formatHours = (value) => `${Number(value || 0).toFixed(1)} hours`;
  const chartData = {
    labels: monthlyTrend.map((item) => item.label),
    datasets: [
      {
        label: 'Filed',
        data: monthlyTrend.map((item) => item.filed),
        backgroundColor: '#4f46e5',
        borderRadius: 8,
        maxBarThickness: 26,
      },
      {
        label: 'Resolved',
        data: monthlyTrend.map((item) => item.resolved),
        backgroundColor: '#10b981',
        borderRadius: 8,
        maxBarThickness: 26,
      },
      {
        label: 'Still Open',
        data: monthlyTrend.map((item) => item.open),
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        maxBarThickness: 26,
      },
      {
        type: 'line',
        label: 'Avg Resolution Time (hours)',
        data: monthlyTrend.map((item) => item.avgResolutionHours || 0),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Analytics & Reports</h2>
          <p className="text-gray-600">Live metrics for grievances assigned to your office account</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-50 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">Resolution Statistics</h3>
          <div className="space-y-4">
            {[
              ['Total Cases', summary.totalCases, 'text-gray-900'],
              ['Resolved', summary.resolved, 'text-green-600'],
              ['Pending Review', summary.pending, 'text-yellow-600'],
              ['In Progress', summary.inProgress, 'text-blue-600'],
              ['Escalated', summary.escalated, 'text-purple-600'],
            ].map(([label, value, className]) => (
              <div key={label} className="flex justify-between">
                <span>{label}</span>
                <span className={`font-bold ${className}`}>{loading ? '--' : value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">Response Time Analysis</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Average Resolution Time</span>
                <span className="font-bold">{loading ? '--' : formatHours(avgResolutionHours)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (avgResolutionHours / 72) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Resolution Rate</span>
                <span className="font-bold">{loading ? '--' : `${summary.resolutionRate}%`}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${summary.resolutionRate}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6">
        <h3 className="font-bold text-gray-900 mb-2">Monthly Trends</h3>
        <p className="text-sm text-gray-500 mb-6">Filed, resolved, still-open cases, and average resolution hours over the last 6 months.</p>
        <div className="bg-white rounded-xl p-4" style={{ minHeight: '400px' }}>
          {loading ? (
            <div className="h-[360px] animate-pulse rounded-xl bg-gray-100"></div>
          ) : monthlyTrend.length === 0 ? (
            <div className="h-[360px] flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              No trend data available yet.
            </div>
          ) : (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      boxWidth: 12,
                      padding: 15,
                      font: {
                        size: 13,
                        weight: 500,
                      },
                      color: '#374151',
                    },
                  },
                  tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.9)',
                    padding: 12,
                    borderRadius: 8,
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                  },
                },
                scales: {
                  y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                      color: '#f3f4f6',
                      drawBorder: false,
                    },
                    ticks: {
                      color: '#6b7280',
                    },
                  },
                  y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                      drawOnChartArea: false,
                    },
                    ticks: {
                      color: '#7c3aed',
                      callback: (value) => `${value}h`,
                    },
                  },
                  x: {
                    grid: {
                      display: false,
                    },
                    ticks: {
                      color: '#6b7280',
                    },
                  },
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

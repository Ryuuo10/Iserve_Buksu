import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { axiosInstance } from '../../../services/authService';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export const ResolutionTimeReportModule = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResolutionData = async () => {
      try {
        const response = await axiosInstance.get('/offices/grievances/resolution-stats');
        if (response.data?.success) {
          setReport(response.data.data);
          setError('');
        } else {
          setError('Unable to load resolution report.');
        }
      } catch (fetchError) {
        console.error('Failed to fetch office resolution report:', fetchError);
        setError(fetchError.response?.data?.message || 'Failed to load resolution report.');
      } finally {
        setLoading(false);
      }
    };

    fetchResolutionData();
  }, []);

  const summary = report?.summary || {
    avgResolutionTime: 0,
    medianTime: 0,
    maxTime: 0,
    minTime: 0,
    totalResolved: 0,
    withinSLA: 0,
    slaCompliance: 0,
  };

  const weeklyTrend = report?.weeklyTrend || [];
  const categoryBreakdown = report?.categoryBreakdown || [];
  const chartData = {
    labels: weeklyTrend.map((item) => item.label),
    datasets: [
      {
        label: 'Average Resolution Time (hours)',
        data: weeklyTrend.map((item) => item.average),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Resolution Time Reports</h2>
          <p className="text-gray-600">Live resolution performance for your assigned grievance queue</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Avg Resolution Time',
            value: summary.avgResolutionTime,
            suffix: 'hours',
            bgClasses: 'from-blue-50 to-blue-100',
            borderClass: 'border-blue-200',
            textClass: 'text-blue-900',
            accentClass: 'text-blue-600',
          },
          {
            label: 'SLA Compliance',
            value: summary.slaCompliance,
            suffix: '%',
            bgClasses: 'from-green-50 to-green-100',
            borderClass: 'border-green-200',
            textClass: 'text-green-900',
            accentClass: 'text-green-600',
          },
          {
            label: 'Median Time',
            value: summary.medianTime,
            suffix: 'hours',
            bgClasses: 'from-purple-50 to-purple-100',
            borderClass: 'border-purple-200',
            textClass: 'text-purple-900',
            accentClass: 'text-purple-600',
          },
          {
            label: 'Total Resolved',
            value: summary.totalResolved,
            suffix: 'cases',
            bgClasses: 'from-amber-50 to-amber-100',
            borderClass: 'border-amber-200',
            textClass: 'text-amber-900',
            accentClass: 'text-amber-600',
          },
        ].map(({ label, value, suffix, bgClasses, borderClass, textClass, accentClass }) => {
          return (
            <div key={label} className={`bg-gradient-to-br ${bgClasses} rounded-xl p-6 border ${borderClass}`}>
              <p className={`${accentClass} text-sm font-semibold uppercase tracking-wide mb-2`}>{label}</p>
              <p className={`text-3xl font-bold ${textClass}`}>{loading ? '--' : value}</p>
              <p className={`${accentClass} text-xs mt-2`}>{suffix}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200 mb-8">
        <h3 className="font-bold text-gray-900 mb-4">Resolution Time Range</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Fastest', `${summary.minTime} hours`, 'text-indigo-600'],
            ['Slowest', `${summary.maxTime} hours`, 'text-purple-600'],
            ['Range', `${Math.max(0, summary.maxTime - summary.minTime).toFixed(1)} hours`, 'text-pink-600'],
            ['Within SLA', `${summary.withinSLA} cases`, 'text-cyan-600'],
          ].map(([label, value, color]) => (
            <div key={label} className="bg-white rounded-lg p-4 border border-indigo-100">
              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{loading ? '--' : value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 mb-8">
        <h3 className="font-bold text-gray-900 mb-2">Resolution Time Trend</h3>
        <p className="text-sm text-gray-500 mb-6">Average resolution hours across the last 8 weeks.</p>
        <div className="bg-white rounded-xl p-4" style={{ minHeight: '350px' }}>
          {loading ? (
            <div className="h-[320px] animate-pulse rounded-xl bg-gray-100"></div>
          ) : weeklyTrend.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              No resolved grievance trend data yet.
            </div>
          ) : (
            <Line
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
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: '#f3f4f6',
                      drawBorder: false,
                    },
                    ticks: {
                      color: '#6b7280',
                      callback: (value) => `${value} hours`,
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

      <div className="bg-gray-50 rounded-2xl p-6">
        <h3 className="font-bold text-gray-900 mb-6">Resolution by Category</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-gray-100"></div>
            ))}
          </div>
        ) : categoryBreakdown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No resolved grievance categories yet.
          </div>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((item) => (
              <div key={item.category} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.category || 'Uncategorized'}</p>
                    <p className="text-sm text-gray-600">{item.resolved} cases resolved</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    item.avgTime <= 36 ? 'bg-green-100 text-green-800' :
                    item.avgTime <= 72 ? 'bg-blue-100 text-blue-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {item.avgTime} hours
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.avgTime <= 36 ? 'bg-green-500' :
                      item.avgTime <= 72 ? 'bg-blue-500' :
                      'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, summary.maxTime > 0 ? (item.avgTime / summary.maxTime) * 100 : 0)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

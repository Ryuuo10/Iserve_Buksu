import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import authService from '../../../services/authService';
import API_BASE_URL from '../../../config/api';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const defaultStats = {
  totalCases: 0,
  resolved: 0,
  pending: 0,
  inProgress: 0,
  avgResponseTime: 0,
  avgResolutionHours: 0,
  resolutionRate: 0,
  totalUsers: 0,
  activeUsers: 0,
  totalOffices: 0,
};

const AnalyticsModule = () => {
  const [stats, setStats] = useState(defaultStats);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = authService.getToken();
        const response = await axios.get(`${API_BASE_URL}/admin/analytics`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success && response.data.data) {
          setStats(response.data.data.summary || defaultStats);
          setMonthlyTrend(response.data.data.monthlyTrend || []);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const avgResolutionHours = stats.avgResolutionHours ?? stats.avgResponseTime ?? 0;
  const formatHours = (value) => `${Number(value || 0).toFixed(1)} hours`;

  const monthlyData = {
    labels: monthlyTrend.map((item) => item.label),
    datasets: [
      {
        label: 'Total Cases',
        data: monthlyTrend.map((item) => item.filed || 0),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Resolved',
        data: monthlyTrend.map((item) => item.resolved || 0),
        borderColor: '#059669',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Still Open',
        data: monthlyTrend.map((item) => item.pending || 0),
        borderColor: '#d97706',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Avg Resolution Time (hours)',
        data: monthlyTrend.map((item) => item.avgResolutionHours || 0),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
      },
    ],
  };

  const activeUsersPercent = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  const responseScore = Math.max(0, Math.min(((120 - avgResolutionHours) / 120) * 100, 100));

  const handleDownloadMonthlyPdf = async (mode = 'full') => {
    if (!chartRef.current) {
      return;
    }

    try {
      setExporting(true);
      const { jsPDF } = await import('jspdf');
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const title = 'Grievance Volume (Monthly)';
      const subtitle = `Generated: ${new Date().toLocaleString()}`;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(title, margin, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(90);
      doc.text(subtitle, margin, 60);

      const imageWidth = pageWidth - margin * 2;
      const imageHeight = 300;
      const chartY = 80;
      doc.addImage(chartImage, 'PNG', margin, chartY, imageWidth, imageHeight);

      const cardsY = chartY + imageHeight + 18;
      const cardGap = 12;
      const cardWidth = (imageWidth - cardGap * 3) / 4;
      const cardHeight = 56;
      const cardStyles = [
        { label: 'Total Cases', value: stats.totalCases, fill: [237, 242, 255], text: [37, 99, 235] },
        { label: 'Resolved', value: stats.resolved, fill: [236, 253, 245], text: [5, 150, 105] },
        { label: 'Pending', value: stats.pending, fill: [255, 247, 237], text: [217, 119, 6] },
        { label: 'Resolution Rate', value: `${stats.resolutionRate}%`, fill: [245, 240, 255], text: [109, 40, 217] },
      ];

      cardStyles.forEach((card, index) => {
        const x = margin + index * (cardWidth + cardGap);
        doc.setFillColor(...card.fill);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(x, cardsY, cardWidth, cardHeight, 8, 8, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...card.text);
        doc.text(card.label, x + 12, cardsY + 18);
        doc.setFontSize(16);
        doc.text(String(card.value), x + 12, cardsY + 40);
      });

      const panelY = cardsY + cardHeight + 14;
      const panelGap = 14;
      const panelWidth = (imageWidth - panelGap) / 2;
      const panelHeight = 90;

      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, panelY, panelWidth, panelHeight, 8, 8, 'FD');
      doc.roundedRect(margin + panelWidth + panelGap, panelY, panelWidth, panelHeight, 8, 8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.text('User Statistics', margin + 12, panelY + 18);
      doc.text('Response Analysis', margin + panelWidth + panelGap + 12, panelY + 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(`Total Users: ${stats.totalUsers}`, margin + 12, panelY + 38);
      doc.text(`Active Users: ${stats.activeUsers}`, margin + 12, panelY + 56);

      doc.text(`Avg Resolution Time: ${formatHours(avgResolutionHours)}`, margin + panelWidth + panelGap + 12, panelY + 38);
      doc.text(`Total Offices: ${stats.totalOffices}`, margin + panelWidth + panelGap + 12, panelY + 56);

      if (mode === 'selected' && selectedMonth) {
        const selectedRow = monthlyTrend.find((item) => item.label === selectedMonth);
        if (selectedRow) {
          const infoY = panelY + panelHeight + 18;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(31, 41, 55);
          doc.text(`Selected month: ${selectedMonth}`, margin, infoY);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(75, 85, 99);
          doc.text(`Filed: ${selectedRow.filed || 0}`, margin, infoY + 18);
          doc.text(`Resolved: ${selectedRow.resolved || 0}`, margin + 140, infoY + 18);
          doc.text(`Still open: ${selectedRow.pending || 0}`, margin + 300, infoY + 18);
          doc.text(`Avg resolution: ${formatHours(selectedRow.avgResolutionHours)}`, margin + 440, infoY + 18);
        }
      }

      const suffix = mode === 'selected' && selectedMonth
        ? `-${selectedMonth.replace(/\s+/g, '-')}`
        : '';
      doc.save(`grievance-volume-monthly${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-white font-heading-md">Analytics & Reports</h2>
            <p className="text-white/80 font-body-sm">System performance metrics and data insights</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-600 text-sm font-medium">Total Cases</span>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalCases}</p>
            <p className="text-blue-700 text-sm mt-1">All grievances filed</p>
          </div>

          <div className="bg-green-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-600 text-sm font-medium">Resolved</span>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.resolved}</p>
            <p className="text-green-700 text-sm mt-1">Cases closed</p>
          </div>

          <div className="bg-orange-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-600 text-sm font-medium">Pending</span>
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-orange-900">{stats.pending}</p>
            <p className="text-orange-700 text-sm mt-1">Awaiting action</p>
          </div>

          <div className="bg-purple-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-600 text-sm font-medium">Resolution Rate</span>
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-purple-900">{stats.resolutionRate}%</p>
            <p className="text-purple-700 text-sm mt-1">Success rate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">User Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Users</span>
                <span className="font-bold text-gray-900">{stats.totalUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Users</span>
                <span className="font-bold text-green-600">{stats.activeUsers}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${activeUsersPercent}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">Response Analysis</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Resolution Time</span>
                <span className="font-bold text-blue-600">{formatHours(avgResolutionHours)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Offices</span>
                <span className="font-bold text-gray-900">{stats.totalOffices}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${responseScore}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h3 className="font-bold text-gray-900">Monthly Trends</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
              >
                <option value="">Select month</option>
                {monthlyTrend.map((item) => (
                  <option key={item.label} value={item.label}>{item.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleDownloadMonthlyPdf('selected')}
                disabled={exporting || !chartRef.current || !selectedMonth}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting ? 'Generating PDF...' : 'Download Selected Month'}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadMonthlyPdf('full')}
                disabled={exporting || !chartRef.current}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting ? 'Generating PDF...' : 'Download Full PDF'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            &quot;Still Open&quot; shows cases filed that month which remain unresolved today. Monthly average resolution time uses cases resolved in that month.
          </p>
          <div className="bg-white rounded-xl p-4" style={{ minHeight: '400px' }}>
            <Line
              ref={chartRef}
              data={monthlyData}
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
                    titleFont: {
                      size: 14,
                      weight: 'bold',
                    },
                    bodyFont: {
                      size: 13,
                    },
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
                      font: {
                        size: 12,
                      },
                    },
                    border: {
                      display: false,
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
                    border: {
                      display: false,
                    },
                  },
                  x: {
                    grid: {
                      display: false,
                    },
                    ticks: {
                      color: '#6b7280',
                      font: {
                        size: 12,
                      },
                    },
                  },
                },
              }}
            />
            {monthlyTrend.length === 0 && (
              <p className="text-center text-sm text-gray-400 mt-4">No monthly grievance data available yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsModule;

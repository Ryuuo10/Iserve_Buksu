import React, { useEffect, useState } from 'react';
import adminService from '../../services/adminService';

const PAGE_SIZE = 20;

const AuditLogsModule = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
  });
  const [expandedLog, setExpandedLog] = useState(null);
  const [stats, setStats] = useState({
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
    byType: [],
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  });

  useEffect(() => {
    fetchLogsAndStats();
  }, [appliedFilters, pagination.page]);

  const fetchLogsAndStats = async () => {
    try {
      setLoading(true);
      const skip = (pagination.page - 1) * PAGE_SIZE;
      const [logsResponse, statsResponse] = await Promise.all([
        adminService.getAuditLogs({ ...appliedFilters, limit: PAGE_SIZE, skip }),
        adminService.getAuditLogsStats(appliedFilters),
      ]);

      if (logsResponse.success) {
        const total = logsResponse.total || 0;
        setLogs(logsResponse.data || []);
        setPagination((prev) => ({
          ...prev,
          total,
          totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        }));
      }

      if (statsResponse.success) {
        setStats(statsResponse.data || { totalCount: 0, successCount: 0, failureCount: 0, byType: [] });
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    setExpandedLog(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    const cleared = { type: '', startDate: '', endDate: '' };
    setExpandedLog(null);
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      const response = await adminService.exportAuditLogs(appliedFilters);
      if (!response.success) {
        return;
      }

      const blob = new Blob([JSON.stringify(response.data || [], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const getLogTypeColor = (type) => {
    const colors = {
      login: 'bg-blue-100 text-blue-800',
      logout: 'bg-gray-100 text-gray-800',
      create: 'bg-green-100 text-green-800',
      update: 'bg-yellow-100 text-yellow-800',
      delete: 'bg-red-100 text-red-800',
      export: 'bg-purple-100 text-purple-800',
      download: 'bg-cyan-100 text-cyan-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const eventTypeCounts = Object.fromEntries((stats.byType || []).map((entry) => [entry._id, entry.count]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
        <p className="text-gray-600 mt-1">View system activity and administrative actions</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
            <select
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Events</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
              <option value="download">Download</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApplyFilters}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log, idx) => (
              <div
                key={log._id || idx}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getLogTypeColor(log.type)}`}>
                        {log.type?.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {log.user?.email || 'Unknown user'} • {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </div>

                {expandedLog === idx && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700"><strong>User:</strong> {log.user?.email || 'Unknown user'}</p>
                    <p className="text-sm text-gray-700 mt-2"><strong>Action:</strong> {log.description}</p>
                    <p className="text-sm text-gray-700 mt-2"><strong>Timestamp:</strong> {new Date(log.createdAt).toLocaleString()}</p>
                    {log.details && <p className="text-sm text-gray-700 mt-2"><strong>Details:</strong> {log.details}</p>}
                    <p className="text-sm text-gray-700 mt-2"><strong>IP Address:</strong> {log.ipAddress || 'N/A'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {pagination.page} of {pagination.totalPages} • {pagination.total} total logs
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <p className="text-sm opacity-90">Total Logs</p>
          <p className="text-2xl font-bold mt-1">{stats.totalCount}</p>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
          <p className="text-sm opacity-90">Successful Actions</p>
          <p className="text-2xl font-bold mt-1">{stats.successCount}</p>
        </div>
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-4 text-white">
          <p className="text-sm opacity-90">Failed Actions</p>
          <p className="text-2xl font-bold mt-1">{stats.failureCount}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <p className="text-sm opacity-90">Filtered Logins</p>
          <p className="text-2xl font-bold mt-1">{eventTypeCounts.login || 0}</p>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsModule;

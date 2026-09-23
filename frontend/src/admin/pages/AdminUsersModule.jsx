import React, { useEffect, useMemo, useState } from 'react';
import adminService from '../../services/adminService';
import {
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_ADMIN_PERMISSIONS,
  getEffectiveAdminPermissions,
  getPermissionLabel,
  normalizeAdminPermissions,
} from '../../utils/adminPermissions';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createDefaultFormData = () => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  permissions: DEFAULT_ADMIN_PERMISSIONS,
});

const ArchiveActionIcon = ({ className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v10m0 0l-4-4m4 4l4-4M4 14h4l2 3h4l2-3h4v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" />
  </svg>
);

const StatCard = ({ label, value, tone = 'blue' }) => {
  const toneClasses = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    purple: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  };

  return (
    <div className={`rounded-2xl border px-5 py-4 ${toneClasses[tone] || toneClasses.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
};

const AdminUsersModule = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState(ADMIN_PERMISSION_GROUPS);
  const [formData, setFormData] = useState(createDefaultFormData());
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await adminService.getAdminUsers();
      if (response.success) {
        setAdmins(response.data || []);
        if (Array.isArray(response.availablePermissions) && response.availablePermissions.length > 0) {
          setAvailablePermissions(response.availablePermissions);
        }
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to load admin users' });
      }
    } catch (error) {
      console.error('Failed to fetch admins:', error);
      setMessage({ type: 'error', text: 'Failed to load admin users' });
    } finally {
      setLoading(false);
    }
  };

  const selectedPermissions = useMemo(
    () => normalizeAdminPermissions(formData.permissions),
    [formData.permissions]
  );

  const totalPermissionCount = useMemo(
    () => availablePermissions.reduce((count, group) => count + group.permissions.length, 0),
    [availablePermissions]
  );

  const adminCount = admins.filter((admin) => admin.role === 'admin').length;
  const superadminCount = admins.filter((admin) => admin.role === 'superadmin').length;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePermissionToggle = (permissionId) => {
    setFormData((prev) => {
      const permissions = new Set(normalizeAdminPermissions(prev.permissions));
      if (permissions.has(permissionId)) {
        permissions.delete(permissionId);
      } else {
        permissions.add(permissionId);
      }

      return {
        ...prev,
        permissions: [...permissions],
      };
    });
  };

  const applyPermissionPreset = (preset) => {
    setFormData((prev) => ({
      ...prev,
      permissions: preset,
    }));
  };

  const validateForm = () => {
    if (!String(formData.name || '').trim()) {
      return 'Full name is required';
    }

    if (!editingAdmin) {
      if (!String(formData.email || '').trim()) {
        return 'Email address is required';
      }

      if (!emailRegex.test(formData.email)) {
        return 'Enter a valid email address';
      }
    }

    if (!editingAdmin || formData.password) {
      if (String(formData.password || '').length < 8) {
        return 'Password must be at least 8 characters';
      }

      if (formData.password !== formData.confirmPassword) {
        return 'Passwords do not match';
      }
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    try {
      let response;
      if (editingAdmin) {
        response = await adminService.updateAdminUser(
          editingAdmin._id,
          String(formData.name).trim(),
          formData.password || undefined,
          editingAdmin.role === 'admin' ? selectedPermissions : undefined
        );
      } else {
        response = await adminService.createAdminUser(
          String(formData.name).trim(),
          String(formData.email).trim().toLowerCase(),
          formData.password,
          selectedPermissions
        );
      }

      if (response.success) {
        setMessage({ type: 'success', text: editingAdmin ? 'Admin updated successfully' : 'Admin created successfully' });
        setFormData(createDefaultFormData());
        setShowForm(false);
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to save admin' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save admin' });
    }
  };

  const handleEdit = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: '',
      confirmPassword: '',
      permissions: getEffectiveAdminPermissions(admin),
    });
    setShowForm(true);
    setMessage({ type: '', text: '' });
  };

  const handleDelete = async (admin) => {
    if (admin.role === 'superadmin') {
      setMessage({ type: 'error', text: 'Superadmin accounts cannot be deleted.' });
      return;
    }

    if (!window.confirm(`Delete admin account for ${admin.email}?`)) {
      return;
    }

    try {
      const response = await adminService.deleteAdminUser(admin._id);

      if (response.success) {
        setMessage({ type: 'success', text: 'Admin deleted successfully' });
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to delete admin' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete admin' });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAdmin(null);
    setFormData(createDefaultFormData());
    setMessage({ type: '', text: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-600">Role Access Control</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Admin Users</h2>
          <p className="mt-3 text-sm text-slate-600">
            Manage admin accounts and assign exactly which modules and actions they can use inside the portal.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingAdmin(null);
              setFormData(createDefaultFormData());
              setMessage({ type: '', text: '' });
            }}
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Create Admin Account
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Admin Accounts" value={adminCount} tone="blue" />
        <StatCard label="Superadmins" value={superadminCount} tone="purple" />
        <StatCard label="Permission Rules" value={totalPermissionCount} tone="emerald" />
      </div>

      {message.text && (
        <div
          className={`rounded-2xl border px-5 py-4 ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <p className="text-sm font-semibold">{message.type === 'success' ? 'Success' : 'Action blocked'}</p>
          <p className="mt-1 text-sm">{message.text}</p>
        </div>
      )}

      {showForm && (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-7 py-6 text-white">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">Access Profile</p>
                <h3 className="mt-2 text-2xl font-bold">
                  {editingAdmin ? 'Edit Admin Account' : 'Create New Admin'}
                </h3>
                <p className="mt-1 text-sm text-blue-100/90">
                  Configure identity details first, then choose the modules this admin can access.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-blue-50">
                <span className="font-semibold">{selectedPermissions.length}</span> of {totalPermissionCount} permissions selected
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-8 px-7 py-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Identity</h4>
                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!!editingAdmin}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="admin@buksu.edu.ph"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Credentials</h4>
                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {editingAdmin ? 'New Password (Optional)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder={editingAdmin ? 'Leave blank to keep current password' : 'Enter password (min 8 characters)'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>

              {(!editingAdmin || editingAdmin.role === 'admin') && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Selection Summary</h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Selected permissions will define the pages, actions, and API access available to this admin.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedPermissions.length > 0 ? (
                      selectedPermissions.map((permissionId) => (
                        <span
                          key={permissionId}
                          className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700"
                        >
                          {getPermissionLabel(permissionId)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">No permissions selected.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {(!editingAdmin || editingAdmin.role === 'admin') && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Permission Matrix</h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Use grouped access controls so superadmin can assign only what this admin actually needs.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset(DEFAULT_ADMIN_PERMISSIONS)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Apply Default Set
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPermissionPreset([])}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {availablePermissions.map((group) => (
                      <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h5 className="text-base font-semibold text-slate-900">{group.label}</h5>
                            <p className="mt-1 text-sm text-slate-600">
                              {group.permissions.filter((permission) => selectedPermissions.includes(permission.id)).length} of{' '}
                              {group.permissions.length} selected
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {group.permissions.map((permission) => {
                            const checked = selectedPermissions.includes(permission.id);
                            return (
                              <label
                                key={permission.id}
                                className={`flex items-start gap-4 rounded-2xl border px-4 py-4 transition ${
                                  checked
                                    ? 'border-blue-200 bg-blue-50 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{permission.label}</p>
                                    {checked && (
                                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
                                        Enabled
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm text-slate-600">{permission.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-2">
                <button
                  type="submit"
                  className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  {editingAdmin ? 'Save Admin Changes' : 'Create Admin Account'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-7 py-5">
          <h3 className="text-xl font-bold text-slate-900">Current Admin Access</h3>
          <p className="mt-1 text-sm text-slate-600">
            Review every admin account, its role, and the exact permission set currently applied.
          </p>
        </div>

        {admins.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500">No admin users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Account</th>
                  <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Role</th>
                  <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Permissions</th>
                  <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Created</th>
                  <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {admins.map((admin) => {
                  const normalizedPermissions = getEffectiveAdminPermissions(admin);

                  return (
                    <tr key={admin._id} className="align-top transition hover:bg-slate-50/70">
                      <td className="px-7 py-5">
                        <p className="text-sm font-semibold text-slate-900">{admin.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{admin.email}</p>
                      </td>
                      <td className="px-7 py-5">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            admin.role === 'superadmin'
                              ? 'border border-purple-200 bg-purple-50 text-purple-700'
                              : 'border border-blue-200 bg-blue-50 text-blue-700'
                          }`}
                        >
                          {admin.role}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        {admin.role === 'superadmin' ? (
                          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                            Full access
                          </span>
                        ) : normalizedPermissions.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {normalizedPermissions.map((permissionId) => (
                              <span
                                key={permissionId}
                                className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                              >
                                {getPermissionLabel(permissionId)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">No permissions assigned</span>
                        )}
                      </td>
                      <td className="px-7 py-5 text-sm text-slate-600">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-7 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEdit(admin)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            Edit Access
                          </button>
                          <button
                            onClick={() => handleDelete(admin)}
                            disabled={admin.role === 'superadmin'}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ArchiveActionIcon />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersModule;

import { useState, useEffect, useRef } from 'react';
import authService, { axiosInstance } from '../../../services/authService';

const ProfileModule = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const fileRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authService.getProfile();
        if (res.success) {
          setUserInfo(res.user);
          setForm({ name: res.user.name || '', email: res.user.email || '' });
        }
      } catch {
        console.error('Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await axiosInstance.put('/auth/profile', { name: form.name.trim() });
      if (res.data.success) {
        setUserInfo((prev) => ({ ...prev, name: form.name.trim() }));
        authService.updateUser({ name: form.name.trim() });
        setEditing(false);
        showToast('Profile updated successfully');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast('Please upload a JPG, PNG, or WebP image', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5 MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await axiosInstance.post('/cloudinary/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadRes.data.success) {
        const url = uploadRes.data.url;
        const profileRes = await axiosInstance.put('/auth/profile', { profilePicture: url });
        if (profileRes.data.success) {
          setUserInfo((prev) => ({ ...prev, profilePicture: url }));
          authService.updateUser({ profilePicture: url });
          showToast('Profile photo updated');
        }
      }
    } catch {
      showToast('Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setForm({ name: userInfo?.name || '', email: userInfo?.email || '' });
    setEditing(false);
  };

  const infoRows = userInfo
    ? [
        { label: 'Email', value: userInfo.email },
        { label: 'Role', value: (userInfo.role || '').replace('_', ' ').toUpperCase() },
        { label: 'Status', value: userInfo.status, badge: true },
        { label: 'Verified', value: userInfo.isVerified ? 'Yes' : 'No' },
        { label: 'Last login', value: userInfo.lastLogin ? new Date(userInfo.lastLogin).toLocaleString() : 'Never' },
        { label: 'Member since', value: userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '--' },
      ]
    : [];

  const statusColor = (s) => {
    if (s === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'inactive') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  /* ── Skeleton ── */
  const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 !rounded-full" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="h-5 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 shadow-lg transition-all duration-300 ${
          toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {toast.type === 'error'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />}
          </svg>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* ── Profile Header Card ── */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Cover band */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600" />

        <div className="px-8 pb-8">
          {/* Avatar + name row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-14">
            {/* Avatar */}
            <div className="relative group">
              <div className="h-28 w-28 rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
                {userInfo?.profilePicture ? (
                  <img src={userInfo.profilePicture} alt={userInfo.name} className="h-full w-full object-cover" />
                ) : (
                  userInfo?.name?.charAt(0).toUpperCase() || 'A'
                )}
              </div>
              {/* Upload overlay */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingPhoto ? (
                  <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 sm:pb-1">
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-xl font-bold text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">{userInfo?.name || 'Admin'}</h2>
              )}
              <p className="mt-1 text-sm text-gray-500">{userInfo?.email}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {saving && (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    Save
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Account Details Card ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Account Details</h3>
        <dl className="divide-y divide-gray-100">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <dt className="text-sm font-medium text-gray-500">{row.label}</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {row.badge ? (
                  <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${statusColor(row.value)}`}>
                    {row.value || '--'}
                  </span>
                ) : (
                  row.value || '--'
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Security Card ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Security</h3>
        <p className="text-sm text-gray-500 mb-6">Manage your account security settings</p>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Password</p>
              <p className="text-xs text-gray-500">Last changed: Unknown</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => showToast('Password change coming soon', 'error')}
          >
            Change
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProfileModule;

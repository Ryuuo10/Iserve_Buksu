import { useState, useEffect } from 'react';
import authService, { axiosInstance } from '../../../services/authService';
import { getLoginRouteForRole } from '../../../utils/authRoutes';

const SettingsModule = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  /* ── password change ── */
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, newPw: false, confirm: false });

  /* ── account info edit ── */
  const [nameForm, setNameForm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  /* ── delete account ── */
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authService.getProfile();
        if (res.success) {
          setUserInfo(res.user);
          setNameForm(res.user.name || '');
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Password change handler ── */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      showToast('All password fields are required', 'error');
      return;
    }
    if (pwForm.newPw.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      showToast('New passwords do not match', 'error');
      return;
    }
    setPwSaving(true);
    try {
      const res = await axiosInstance.post('/auth/change-password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.newPw,
      });
      if (res.data.success) {
        showToast('Password changed successfully');
        setPwForm({ current: '', newPw: '', confirm: '' });
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  /* ── Name update handler ── */
  const handleNameSave = async () => {
    if (!nameForm.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setNameSaving(true);
    try {
      const res = await axiosInstance.put('/auth/profile', { name: nameForm.trim() });
      if (res.data.success) {
        setUserInfo((prev) => ({ ...prev, name: nameForm.trim() }));
        authService.updateUser({ name: nameForm.trim() });
        setEditingName(false);
        showToast('Name updated successfully');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update name', 'error');
    } finally {
      setNameSaving(false);
    }
  };

  /* ── Logout handler ── */
  const handleLogout = () => {
    Promise.resolve(authService.logout()).finally(() => {
      window.location.href = '/';
    });
  };

  /* ── Delete account handler ── */
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }
    if (userInfo?.hasPassword === false) {
      showToast('This account uses Google Sign-In only, so password-based account deletion is not available.', 'error');
      return;
    }
    if (!deletePassword) {
      showToast('Password is required to delete your account', 'error');
      return;
    }
    setDeleting(true);
    try {
      const res = await axiosInstance.delete('/auth/account', { data: { password: deletePassword } });
      if (res.data.success) {
        showToast('Account deleted successfully');
        setTimeout(() => {
          authService.logout();
          window.location.href = getLoginRouteForRole(userInfo?.role);
        }, 1500);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal(false);
    setDeleteConfirmText('');
    setDeletePassword('');
    setShowDeletePassword(false);
  };

  /* ── Eye toggle icon ── */
  const EyeToggle = ({ visible, onToggle }) => (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
      {visible ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[3, 4].map((n) => (
            <div key={n} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* ── Row 1: Account Info + Change Password ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── Account Information ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col items-start text-left">
        <div className="flex items-center gap-3 mb-6 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Account Information</h3>
            <p className="text-sm text-gray-500">Manage your account details</p>
          </div>
        </div>

        <div className="space-y-5 w-full">
          {/* Name */}
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Display Name</p>
              {editingName ? (
                <input
                  type="text"
                  value={nameForm}
                  onChange={(e) => setNameForm(e.target.value)}
                  className="mt-1 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              ) : (
                <p className="mt-1 text-sm font-semibold text-gray-900">{userInfo?.name || '--'}</p>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              {editingName ? (
                <>
                  <button onClick={() => { setEditingName(false); setNameForm(userInfo?.name || ''); }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleNameSave} disabled={nameSaving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {nameSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingName(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Edit</button>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email Address</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{userInfo?.email || '--'}</p>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
          </div>

          {/* Role (read-only) */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Role</p>
            <span className="mt-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {(userInfo?.role || '').replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </section>

      {/* ── Change Password ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col items-start text-left">
        <div className="flex items-center gap-3 mb-6 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
            <p className="text-sm text-gray-500">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 w-full">
          {userInfo?.hasPassword === false && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              This account currently uses Google Sign-In only, so password changes are not available here.
            </div>
          )}

          {/* Current password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                disabled={userInfo?.hasPassword === false}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                placeholder="Enter current password"
              />
              <EyeToggle visible={showPasswords.current} onToggle={() => setShowPasswords((s) => ({ ...s, current: !s.current }))} />
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.newPw ? 'text' : 'password'}
                value={pwForm.newPw}
                onChange={(e) => setPwForm((f) => ({ ...f, newPw: e.target.value }))}
                disabled={userInfo?.hasPassword === false}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                placeholder="Enter new password (min. 8 characters)"
              />
              <EyeToggle visible={showPasswords.newPw} onToggle={() => setShowPasswords((s) => ({ ...s, newPw: !s.newPw }))} />
            </div>
            {pwForm.newPw && pwForm.newPw.length < 8 && (
              <p className="mt-1 text-xs text-amber-600">Password must be at least 8 characters</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                disabled={userInfo?.hasPassword === false}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                placeholder="Confirm new password"
              />
              <EyeToggle visible={showPasswords.confirm} onToggle={() => setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))} />
            </div>
            {pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={pwSaving || userInfo?.hasPassword === false}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {pwSaving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Update Password
            </button>
          </div>
        </form>
      </section>

      </div>

      {/* ── Row 2: Session & Danger Zone ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── Session & Security ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col items-start text-left">
        <div className="flex items-center gap-3 mb-6 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Session & Security</h3>
            <p className="text-sm text-gray-500">Your current session details</p>
          </div>
        </div>

        <div className="space-y-4 w-full">
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-5">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Account Status</p>
              <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                userInfo?.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : userInfo?.status === 'inactive' ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {userInfo?.status || '--'}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Login</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {userInfo?.lastLogin ? new Date(userInfo.lastLogin).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : 'Never'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Account Created</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '--'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Danger Zone ── */}
      <section className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm flex flex-col items-start text-left">
        <div className="flex items-center gap-3 mb-6 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.338 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Danger Zone</h3>
            <p className="text-sm text-gray-500">Irreversible account actions</p>
          </div>
        </div>

        <div className="space-y-4 w-full">
          {/* Logout */}
          <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/50 p-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Log out of your account</p>
              <p className="text-xs text-gray-500 mt-0.5">You will be redirected to the login page</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-5">
            <div>
              <p className="text-sm font-semibold text-red-700">Delete your account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {userInfo?.hasPassword === false
                  ? 'Google-only accounts cannot be deleted here using a password.'
                  : 'Permanently remove your account and all associated data'}
              </p>
            </div>
            <button
              onClick={() => setDeleteModal(true)}
              disabled={userInfo?.hasPassword === false}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors flex items-center gap-2 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v10m0 0l-4-4m4 4l4-4M4 14h4l2 3h4l2-3h4v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5z" />
              </svg>
              Delete Account
            </button>
          </div>
        </div>
      </section>

      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeDeleteModal}>
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.338 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50 p-4 mb-5">
              <p className="text-sm text-red-700">
                This will permanently delete your account, including all your data. You will not be able to recover your account.
              </p>
            </div>

            {/* Type DELETE */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 outline-none focus:ring-1 ${
                  deleteConfirmText && deleteConfirmText !== 'DELETE'
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
                    : deleteConfirmText === 'DELETE'
                    ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500 focus:ring-emerald-500'
                    : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="Type DELETE here"
                autoFocus
              />
              {deleteConfirmText && deleteConfirmText !== 'DELETE' && (
                <p className="mt-1 text-xs text-red-600">Please type DELETE exactly (case-sensitive)</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Enter your password to verify</label>
              <div className="relative">
                <input
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                  placeholder="Enter your password"
                />
                <EyeToggle visible={showDeletePassword} onToggle={() => setShowDeletePassword((v) => !v)} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE' || !deletePassword}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {deleting && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModule;

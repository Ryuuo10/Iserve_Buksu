import { useEffect, useMemo, useState } from 'react';
import authService, { axiosInstance } from '../../../services/authService';

const formatOfficeLabel = (officeValue, categories = []) => {
  if (!officeValue) {
    return 'No office category assigned';
  }

  const matchedCategory = categories.find((category) =>
    category.id === officeValue || category.name === officeValue
  );

  if (matchedCategory?.name) {
    return matchedCategory.name;
  }

  return String(officeValue)
    .replaceAll('_', ' ')
    .toUpperCase();
};

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
};

export const ProfileModule = () => {
  const [officeCategories, setOfficeCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profileResponse, officesResponse] = await Promise.all([
          authService.getProfile(),
          authService.getOffices(),
        ]);

        if (!profileResponse?.success || !profileResponse.user) {
          throw new Error(profileResponse?.message || 'Failed to load profile');
        }

        setProfile(profileResponse.user);
        setAccountForm({
          name: profileResponse.user.name || '',
          phone: profileResponse.user.phone || '',
        });
        setOfficeCategories(officesResponse?.success ? (officesResponse.offices || []) : []);
        setError('');
      } catch (loadError) {
        console.error('Failed to fetch office profile:', loadError);
        setError(loadError.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const officeLabel = useMemo(
    () => formatOfficeLabel(profile?.office, officeCategories),
    [officeCategories, profile?.office]
  );

  const setNotice = (message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }

    window.setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3500);
  };

  const handleAccountChange = (event) => {
    const { name, value } = event.target;
    setAccountForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSave = async () => {
    const trimmedName = accountForm.name.trim();
    if (!trimmedName) {
      setNotice('Display name is required.', 'error');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await axiosInstance.put('/auth/profile', {
        name: trimmedName,
        phone: accountForm.phone.trim(),
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update profile');
      }

      const updatedProfile = {
        ...(profile || {}),
        ...response.data.user,
        updatedAt: new Date().toISOString(),
      };

      setProfile(updatedProfile);
      setAccountForm({
        name: updatedProfile.name || '',
        phone: updatedProfile.phone || '',
      });
      authService.updateUser(response.data.user);
      window.dispatchEvent(new CustomEvent('auth-profile-updated', { detail: response.data.user }));
      setNotice('Profile updated successfully.');
    } catch (saveError) {
      console.error('Failed to update office profile:', saveError);
      setNotice(saveError.response?.data?.message || saveError.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setNotice('Fill in all password fields.', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setNotice('New password must be at least 8 characters.', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice('New password and confirmation do not match.', 'error');
      return;
    }

    try {
      setSavingPassword(true);
      const response = await axiosInstance.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to change password');
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setNotice('Password changed successfully.');
    } catch (saveError) {
      console.error('Failed to change office password:', saveError);
      setNotice(saveError.response?.data?.message || saveError.message || 'Failed to change password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const resetAccountForm = () => {
    setAccountForm({
      name: profile?.name || '',
      phone: profile?.phone || '',
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="h-8 w-44 animate-pulse rounded bg-gray-100"></div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div className="h-72 animate-pulse rounded-2xl bg-gray-100"></div>
            <div className="h-72 animate-pulse rounded-2xl bg-gray-100"></div>
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-gray-100"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-500">Profile</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-900">Office user account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage your personal account details, review your office assignment, and secure your sign-in credentials.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900">Account Information</h3>
            <p className="text-sm text-gray-500">These details belong to the logged-in office user account.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
              <input
                type="text"
                name="name"
                value={accountForm.name}
                onChange={handleAccountChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={accountForm.phone}
                onChange={handleAccountChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Office Category</label>
              <input
                type="text"
                value={officeLabel}
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetAccountForm}
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-5">Account Status</h3>
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Role</p>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {profile?.role === 'office_handler' ? 'Office Handler' : profile?.role}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Verification</p>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {profile?.isVerified ? 'Verified' : 'Pending Verification'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Last Login</p>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {formatDateTime(profile?.lastLogin)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Member Since</p>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {formatDateTime(profile?.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900">Security</h3>
          <p className="text-sm text-gray-500">Change the password used by this office account.</p>
        </div>

        {profile?.hasPassword === false ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            This account currently uses Google Sign-In only, so password changes are not available here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handlePasswordSave}
                disabled={savingPassword}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

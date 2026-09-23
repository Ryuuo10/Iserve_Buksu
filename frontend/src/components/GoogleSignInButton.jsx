import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import authService from '../services/authService';
import OfficeSelectionModal from './OfficeSelectionModal';
import ComplainantTypeModal from './ComplainantTypeModal';
import { getDashboardRouteForRole, getLoginRouteForRole } from '../utils/authRoutes';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const getCurrentOrigin = () =>
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:5173';

const getGoogleOriginHelpHtml = (fallbackText) => {
  const currentOrigin = getCurrentOrigin();

  return `
    <div class="text-left">
      <p class="mb-3"><strong>Google Sign-In requires configuration:</strong></p>
      <ol class="list-decimal pl-5 space-y-2 text-sm">
        <li>Go to <a href="https://console.cloud.google.com/" target="_blank" class="text-blue-600 underline">Google Cloud Console</a></li>
        <li>Navigate to "APIs & Services" -> "Credentials"</li>
        <li>Edit your OAuth 2.0 Client ID</li>
        <li>Add your current authorized origin:
          <div class="bg-gray-100 p-2 mt-2 rounded text-xs break-all">
            ${currentOrigin}
          </div>
        </li>
        <li>If you switch local URLs, also add:
          <div class="bg-gray-100 p-2 mt-2 rounded text-xs">
            http://localhost:5173<br>
            http://127.0.0.1:5173<br>
            http://localhost:5174<br>
            http://127.0.0.1:5174
          </div>
        </li>
        <li>Save and try again after a minute.</li>
      </ol>
      <p class="mt-3"><strong>${fallbackText}</strong></p>
    </div>
  `;
};

function GoogleSignInButton({ role, context = 'login' }) {
  const navigate = useNavigate();
  const [showOfficeSelectionModal, setShowOfficeSelectionModal] = useState(false);
  const [showComplainantTypeModal, setShowComplainantTypeModal] = useState(false);
  const [availableOffices, setAvailableOffices] = useState([]);
  const [isOfficeLoading, setIsOfficeLoading] = useState(false);
  const [isComplainantTypeLoading, setIsComplainantTypeLoading] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState(null);
  const [pendingOfficeUser, setPendingOfficeUser] = useState(null);
  const [pendingComplainantUser, setPendingComplainantUser] = useState(null);

  const handleOfficeSelectionRequired = async (googleToken, officeUser) => {
    setIsOfficeLoading(true);

    try {
      const officesResult = await authService.getOffices();

      if (!officesResult.success) {
        Swal.fire({
          icon: 'error',
          title: 'Unable to Load Offices',
          text: officesResult.message || 'Please try again before continuing your office registration.',
          confirmButtonColor: '#d33',
        });
        return;
      }

      setPendingGoogleToken(googleToken);
      setPendingOfficeUser({ user: officeUser });
      setAvailableOffices(officesResult.offices || []);
      setShowOfficeSelectionModal(true);
    } finally {
      setIsOfficeLoading(false);
    }
  };

  const handleComplainantTypeRequired = (googleToken, complainantUser) => {
    setPendingGoogleToken(googleToken);
    setPendingComplainantUser(complainantUser);
    setShowComplainantTypeModal(true);
  };

  const handleOfficeSetupSubmit = async (officeId) => {
    if (!pendingGoogleToken) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please try signing in with Google again.',
        confirmButtonColor: '#d33',
      });
      throw new Error('Missing pending Google token');
    }

    const setupResult = await authService.completeGoogleOfficeSetup(pendingGoogleToken, officeId);

    if (!setupResult.success) {
      const title = setupResult.status === 'ROLE_MISMATCH'
        ? 'Role Mismatch'
        : setupResult.status === 'ALREADY_APPROVED'
          ? 'Already Approved'
          : 'Unable to Submit';

      Swal.fire({
        icon: setupResult.status === 'ALREADY_APPROVED' ? 'info' : 'error',
        title,
        text: setupResult.message || 'We could not finish your office registration right now.',
        confirmButtonColor: setupResult.status === 'ALREADY_APPROVED' ? '#3085d6' : '#d33',
      });

      throw new Error(setupResult.message || 'Office setup failed');
    }

    authService.logout();
    setShowOfficeSelectionModal(false);
    setPendingGoogleToken(null);
    setPendingOfficeUser(null);

    await Swal.fire({
      icon: 'info',
      title: 'Account Pending Approval',
      html: `
        <div style="text-align: left; line-height: 1.6;">
          <p>Your office account request has been submitted successfully.</p>
          <p>Please wait for the administrator approval email before accessing the office dashboard.</p>
        </div>
      `,
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
      allowOutsideClick: false,
    });
  };

  const handleComplainantSetupSubmit = async (complainantType) => {
    if (!pendingGoogleToken) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please try signing in with Google again.',
        confirmButtonColor: '#d33',
      });
      throw new Error('Missing pending Google token');
    }

    setIsComplainantTypeLoading(true);

    try {
      const setupResult = await authService.completeGoogleComplainantSetup(pendingGoogleToken, complainantType);

      if (!setupResult.success) {
        const title =
          setupResult.status === 'ROLE_MISMATCH'
            ? 'Role Mismatch'
            : setupResult.status === 'ALREADY_COMPLETED'
              ? 'Already Completed'
              : setupResult.status === 'BLOCKED'
                ? 'Account Blocked'
                : 'Unable to Continue';

        Swal.fire({
          icon: setupResult.status === 'ALREADY_COMPLETED' ? 'info' : 'error',
          title,
          text: setupResult.message || 'We could not complete your complainant account right now.',
          confirmButtonColor: setupResult.status === 'ALREADY_COMPLETED' ? '#3085d6' : '#d33',
        });

        throw new Error(setupResult.message || 'Complainant setup failed');
      }

      authService.setToken(setupResult.token);
      authService.setUser(setupResult.user);
      setShowComplainantTypeModal(false);
      setPendingGoogleToken(null);
      setPendingComplainantUser(null);

      const successMessage =
        setupResult.status === 'SUCCESS_NEW_USER'
          ? 'Your complainant account has been created successfully.'
          : `Welcome back, ${setupResult.user.name}!`;

      const successTitle =
        setupResult.status === 'SUCCESS_NEW_USER'
          ? 'Account Created'
          : 'Login Successful';

      await Swal.fire({
        icon: 'success',
        title: successTitle,
        text: successMessage,
        timer: 2000,
        showConfirmButton: false,
      });

      navigate(getDashboardRouteForRole(setupResult.user.role));
    } finally {
      setIsComplainantTypeLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const googleToken = credentialResponse.credential;
      const result = await authService.googleSignIn(googleToken, role);

      if (!result.success) {
        if (result.status === 'ROLE_MISMATCH') {
          Swal.fire({
            icon: 'warning',
            title: 'Role Mismatch',
            html: `<p style="font-size: 16px; color: #666;">This email is already registered as a <strong>${result.existingRole
              .replace('_', ' ')
              .toUpperCase()}</strong></p><p style="font-size: 14px; color: #999; margin-top: 10px;">Please log in with your registered role or use a different email.</p>`,
            confirmButtonText: 'Go to Login',
            confirmButtonColor: '#3085d6',
            allowOutsideClick: true,
          }).then(() => {
            navigate(getLoginRouteForRole(result.existingRole));
          });
        } else if (result.status === 'GOOGLE_ACCOUNT_NOT_REGISTERED') {
          Swal.fire({
            icon: 'info',
            title: 'Complete Signup First',
            html: `
              <p style="font-size: 16px; color: #666; margin-bottom: 15px;">This Google email is not registered yet.</p>
              <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3085d6;">
                <p style="margin: 0; color: #2c5aa0;">Please sign up and choose whether you are a Complainant or Office Handler before using Google login.</p>
              </div>
            `,
            confirmButtonText: 'Go to Signup',
            confirmButtonColor: '#3085d6',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
          }).then((swalResult) => {
            if (swalResult.isConfirmed) {
              navigate('/auth');
            }
          });
        } else if ((result.message || '').includes('already registered') || (result.message || '').includes('exists')) {
          Swal.fire({
            icon: 'info',
            title: context === 'signup' ? 'Account Exists' : 'Login Required',
            html: `
              <p style="font-size: 16px; color: #666; margin-bottom: 15px;">This email is already registered in our system.</p>
              <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3085d6;">
                <p style="margin: 0; font-weight: 500; color: #2c5aa0;">What would you like to do?</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #555;">
                  <li style="margin: 5px 0;">${context === 'signup' ? 'Switch to Login tab and sign in with Google' : 'Sign in with your existing account'}</li>
                  <li style="margin: 5px 0;">If you forgot which role you registered with, contact administrator</li>
                </ul>
              </div>
            `,
            confirmButtonText: context === 'signup' ? 'Go to Login' : 'Try Again',
            confirmButtonColor: '#3085d6',
            showCancelButton: context === 'signup',
            cancelButtonText: 'Cancel'
          }).then((swalResult) => {
            if (swalResult.isConfirmed && context === 'signup') {
              window.dispatchEvent(new CustomEvent('switchToLogin'));
            }
          });
        } else if (result.status === 'NOT_VERIFIED') {
          Swal.fire({
            icon: 'info',
            title: 'Account Pending Approval',
            html: `
              <div style="text-align: left; line-height: 1.6;">
                <p>Your office account is still pending administrator approval.</p>
                <p>Please wait for the approval email before accessing the dashboard.</p>
              </div>
            `,
            confirmButtonColor: '#3085d6',
          });
        } else if (result.status === 'BLOCKED') {
          Swal.fire({
            icon: 'error',
            title: 'Account Blocked',
            text: result.message || 'Your account has been blocked. Please contact the administrator.',
            confirmButtonColor: '#d33',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Authentication Failed',
            text: result.message || 'Failed to authenticate with Google. Please try again.',
            confirmButtonColor: '#d33',
          });
        }
        return;
      }

      if (result.status === 'OFFICE_SELECTION_REQUIRED') {
        await handleOfficeSelectionRequired(googleToken, result.user);
        return;
      }

      if (result.status === 'COMPLAINANT_TYPE_REQUIRED') {
        handleComplainantTypeRequired(googleToken, result.user);
        return;
      }

      authService.setToken(result.token);
      authService.setUser(result.user);

      const successMessage =
        result.status === 'SUCCESS_NEW_USER'
          ? `Welcome! Your ${((role || result.user?.role) || 'account').replace('_', ' ')} account has been created successfully.`
          : `Welcome back, ${result.user.name}!`;

      const successTitle =
        result.status === 'SUCCESS_NEW_USER'
          ? 'Account Created'
          : 'Login Successful';

      Swal.fire({
        icon: 'success',
        title: successTitle,
        text: successMessage,
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        navigate(getDashboardRouteForRole(result.user.role));
      });
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred',
        confirmButtonColor: '#d33',
      });
    }
  };

  const handleGoogleError = (error) => {
    console.error('Google Sign-In Error:', error);
    
    if (error?.error === 'idpiframe_initialization_failed' ||
        error?.details?.includes('origin') ||
        error?.message?.includes('403') ||
        error?.error === 'popup_closed_by_user' ||
        (typeof error === 'string' && error.includes('403'))) {

      if (error.error === 'popup_closed_by_user') {
        return;
      }

      Swal.fire({
        icon: 'warning',
        title: 'Google Sign-In Configuration Needed',
        html: getGoogleOriginHelpHtml('You can still use email/password login below.'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
        width: '500px'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: 'Failed to authenticate with Google. Please try again or use email/password login.',
        confirmButtonColor: '#d33',
      });
    }
  };

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
        Google sign-in is not configured. Use email/password login.
      </div>
    );
  }

  return (
    <div className="relative">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        text="signin_with"
        size="large"
        useOneTap={false}
        shape="rectangular"
      />
      <div className="text-xs text-gray-500 text-center mt-2">
        Having trouble? Use email/password login
      </div>
      {showOfficeSelectionModal && (
        <OfficeSelectionModal
          offices={availableOffices}
          userData={pendingOfficeUser}
          onSelect={handleOfficeSetupSubmit}
          isLoading={isOfficeLoading}
          mode="approval"
        />
      )}
      {showComplainantTypeModal && (
        <ComplainantTypeModal
          isOpen={showComplainantTypeModal}
          onClose={() => {
            if (isComplainantTypeLoading) {
              return;
            }
            setShowComplainantTypeModal(false);
            setPendingGoogleToken(null);
            setPendingComplainantUser(null);
          }}
          onSelect={handleComplainantSetupSubmit}
          isLoading={isComplainantTypeLoading}
          userData={pendingComplainantUser}
        />
      )}
    </div>
  );
}

export default GoogleSignInButton;

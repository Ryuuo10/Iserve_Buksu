import { GoogleLogin } from '@react-oauth/google';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const getCurrentOrigin = () =>
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:5173';

const getGoogleOriginHelpHtml = (fallbackText) => {
  const currentOrigin = getCurrentOrigin();

  return `
    <div class="text-left">
      <p class="mb-3"><strong>Google Sign-Up requires configuration:</strong></p>
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

function GoogleSignUpButton({ onGoogleSignUp }) {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // Decode the credential to get user info
      const decoded = jwtDecode(credentialResponse.credential);
      
      const googleData = {
        token: credentialResponse.credential,
        email: decoded.email,
        fullName: decoded.name,
        profilePicture: decoded.picture,
        googleId: decoded.sub,
      };

      const shouldShowPrefillMessage = await onGoogleSignUp(googleData);

      if (shouldShowPrefillMessage !== false) {
        Swal.fire({
          icon: 'success',
          title: 'Great!',
          text: 'Email and name pre-filled from your Google account',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error('Google Sign-Up Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to process Google account information',
        confirmButtonColor: '#d33',
      });
    }
  };

  const handleGoogleError = (error) => {
    console.error('Google Sign-Up Error:', error);
    
    // Check if it's a 403 or origin error
    if (error?.error === 'idpiframe_initialization_failed' || 
        error?.details?.includes('origin') ||
        error?.message?.includes('403') ||
        (typeof error === 'string' && error.includes('403'))) {
      Swal.fire({
        icon: 'warning',
        title: 'Google Sign-Up Configuration Needed',
        html: getGoogleOriginHelpHtml('In the meantime, please use manual sign-up below.'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
        width: '500px'
      });
    } else if (error?.error === 'popup_closed_by_user') {
      // User closed the popup - not really an error
      return;
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: 'Failed to authenticate with Google. Please try again or use manual sign-up.',
        confirmButtonColor: '#d33',
      });
    }
  };

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
        Google sign-up is not configured. Please fill the form manually.
      </div>
    );
  }

  return (
    <div className="relative">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        text="signup_with"
        size="large"
        useOneTap={false}
        shape="rectangular"
      />
      {/* Fallback message */}
      <div className="text-xs text-gray-500 text-center mt-2">
        Or fill the form manually below
      </div>
    </div>
  );
}

export default GoogleSignUpButton;

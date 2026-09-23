import { GoogleLogin } from '@react-oauth/google';

function GoogleTestButton() {
  // Log the current origin for debugging
  console.log('Current Origin:', window.location.origin);
  console.log('Full URL:', window.location.href);

  const handleSuccess = (response) => {
    console.log('SUCCESS:', response);
    alert('Google Auth Success! Check console for details.');
  };

  const handleError = (error) => {
    console.log('ERROR:', error);
    console.log('Current Origin (on error):', window.location.origin);
    alert('Google Auth Error! Check console for details.');
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-bold mb-4">Google Auth Test</h3>
      <div className="text-sm text-gray-600 mb-2">
        Current Origin: <strong>{window.location.origin}</strong>
      </div>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        text="signin_with"
        size="large"
        useOneTap={false}
      />
    </div>
  );
}

export default GoogleTestButton;
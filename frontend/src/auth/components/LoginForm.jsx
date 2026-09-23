import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AdminLoginForm from "./AdminLoginForm";
import OfficeLoginForm from "./OfficeLoginForm";
import ComplainantLoginForm from "./ComplainantLoginForm";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import authService from "../../services/authService";
import API_BASE_URL from "../../config/api";
import { getDashboardRouteForRole } from "../../utils/authRoutes";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import ForgotPasswordModal from "./ForgotPasswordModal";

function LoginForm({ forcedRole = "", onSignupClick }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [errors, setErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (forcedRole === 'admin') return <AdminLoginForm />;
  if (forcedRole === 'office') return <OfficeLoginForm />;
  if (forcedRole === 'complainant') return <ComplainantLoginForm />;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignupClick = () => {
    if (typeof onSignupClick === 'function') {
      onSignupClick();
      return;
    }

    window.dispatchEvent(new CustomEvent('switchToSignup'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recaptchaToken) {
      setErrors({ recaptcha: "Please verify that you are not a robot" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: formData.email,
        password: formData.password,
        recaptchaToken,
      });

      if (response.data.success) {
        authService.setToken(response.data.token);
        authService.setUser(response.data.user);

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Login successful',
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          navigate(getDashboardRouteForRole(response.data.user.role));
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      setErrors({ general: errorMessage });

      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">Email Address</label>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 border-gray-300 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">Password</label>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 border-gray-300 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
            placeholder="Enter your password"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>
        </div>

        <div className="my-4 flex h-[70px] items-center justify-center overflow-hidden sm:h-auto sm:overflow-visible">
          <div className="origin-center scale-[0.86] sm:scale-100">
            <ReCAPTCHA
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              onChange={(token) => setRecaptchaToken(token)}
            />
          </div>
        </div>
        {errors.recaptcha && <p className="text-red-500 text-xs text-center">{errors.recaptcha}</p>}
        {errors.general && <p className="text-red-500 text-xs text-center">{errors.general}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </div>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="relative flex items-center gap-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-gray-500 text-sm font-medium">OR</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <GoogleSignInButton context="login" />

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-sm text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors"
        >
          Forgot password?
        </button>
      </div>

      <div className="text-center pt-4">
        <p className="text-gray-600 text-sm">
          Don't have an account?{' '}
          <button 
            type="button"
            className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors"
            onClick={handleSignupClick}
          >
            Sign Up
          </button>
        </p>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}

export default LoginForm;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import authService from "../../services/authService";
import Swal from 'sweetalert2';
import ForgotPasswordModal from "./ForgotPasswordModal";
import API_BASE_URL from "../../config/api";
import { getDashboardRouteForRole } from "../../utils/authRoutes";

function AdminLoginForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "admin", // Default to admin
  });
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [errors, setErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      // Send login request with reCAPTCHA token
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: formData.email,
        password: formData.password,
        recaptchaToken: recaptchaToken,
        role: formData.role
      });
      
      if (response.data.success) {
        // Store token and user data
        authService.setToken(response.data.token);
        authService.setUser(response.data.user);
        
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Login successful',
          timer: 1500,
          showConfirmButton: false
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
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.548-.99 3.19-.99 4.732 0 1.548.99 1.548 2.607 0 3.606-1.548 1.001-3.19 1.001-4.732 0-1.548-1.001-2.924-1.001-4.732 0-1.548-1.001-1.548-2.607 0-3.606a1.724 1.724 0 00-2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Administrator Login</h2>
        <p className="text-gray-600">Access system administration panel</p>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 max-w-md mx-auto">
          <p className="text-sm text-blue-800 font-medium">Administrator Access</p>
          <p className="text-xs text-blue-700 mt-1">Manage users, oversee system operations, and configure settings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="username"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            placeholder="admin@university.edu"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            placeholder="Enter your password"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
            Login Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
            required
          >
            <option value="admin">Administrator</option>
            <option value="superadmin">Super Administrator</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Select your role to access the appropriate administrative functions
          </p>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>
          <button 
            type="button" 
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Forgot password?
          </button>
        </div>

        <div className="flex justify-center my-4">
          <ReCAPTCHA
            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
            onChange={(token) => setRecaptchaToken(token)}
          />
        </div>
        {errors.recaptcha && (
          <p className="text-red-500 text-xs text-center">{errors.recaptcha}</p>
        )}
        {errors.general && (
          <p className="text-red-500 text-xs text-center">{errors.general}</p>
        )}

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
            `Sign In as ${formData.role === 'superadmin' ? 'Super Administrator' : 'Administrator'}`
          )}
        </button>
      </form>

      <div className="text-center pt-4">
        <p className="text-gray-600 text-sm">
          Need an account?{' '}
          <button 
            className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('switchToSignup'))}
          >
            Contact System Admin
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}

export default AdminLoginForm;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import authService from "../../services/authService";
import Swal from 'sweetalert2';
import ForgotPasswordModal from "./ForgotPasswordModal";
import API_BASE_URL from "../../config/api";
import { getDashboardRouteForRole } from "../../utils/authRoutes";

function ComplainantLoginForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
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
        role: 'complainant'
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
        <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Complainant Login</h2>
        <p className="text-gray-600">Submit and track your complaints</p>
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 max-w-md mx-auto">
          <p className="text-sm text-green-800 font-medium">I-Serve Grievance Chatbot</p>
          <p className="text-xs text-green-700 mt-1">File new complaints, track existing cases, and communicate with handlers</p>
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
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
            placeholder="student@university.edu"
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
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
            placeholder="Enter your password"
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
            <span className="ml-2 text-sm text-gray-600">Remember me</span>
          </label>
          <button 
            type="button" 
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-green-600 hover:text-green-800 font-medium"
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
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 focus:ring-4 focus:ring-green-300 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
            "Sign In as Complainant"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center gap-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-gray-500 text-sm font-medium">OR</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      {/* Google Sign-In Button */}
      <GoogleSignInButton 
        role="complainant" 
        buttonText="Sign in with Google" 
        context="login"
      />

      <div className="text-center pt-4">
        <p className="text-gray-600 text-sm">
          Don't have an account?{' '}
          <button 
            className="text-green-600 font-semibold hover:text-green-800 hover:underline transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('switchToSignup'))}
          >
            Sign Up
          </button>
        </p>
      </div>
      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />    </div>
  );
}

export default ComplainantLoginForm;

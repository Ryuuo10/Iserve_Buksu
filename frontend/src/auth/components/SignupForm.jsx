import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";
import GoogleSignUpButton from "../../components/GoogleSignUpButton";
import Swal from 'sweetalert2';
import authService from "../../services/authService";
import API_BASE_URL from "../../config/api";
import { getDashboardRouteForRole } from "../../utils/authRoutes";

const ROLE_LABELS = {
  complainant: 'Complainant',
  office_handler: 'Office Handler',
};

function SignupForm({ allowedRoles = ["complainant", "office_handler"], defaultRole = "" }) {
  const navigate = useNavigate();
  const normalizedAllowedRoles = allowedRoles.length ? allowedRoles : ["complainant", "office_handler"];
  const resolvedDefaultRole = defaultRole || (normalizedAllowedRoles.length === 1 ? normalizedAllowedRoles[0] : "");
  const roleSelectionLocked = normalizedAllowedRoles.length === 1;
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    role: resolvedDefaultRole,
    office: "",
    complainantType: "",
    password: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [officeCategories, setOfficeCategories] = useState([]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      role: resolvedDefaultRole,
      office: resolvedDefaultRole === 'office_handler' ? prev.office : '',
    }));
  }, [resolvedDefaultRole]);

  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/offices`);
        if (response.data.success) {
          setOfficeCategories(response.data.offices || []);
        }
      } catch (error) {
        console.error('Failed to fetch office categories:', error);
      }
    };
    fetchOffices();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.role) {
      newErrors.role = "Role selection is required";
    }
    
    if (formData.role === 'office_handler' && !formData.office) {
      newErrors.office = "Office selection is required for office handlers";
    }

    if (formData.role === 'complainant' && !formData.complainantType) {
      newErrors.complainantType = "Complainant type is required";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else {
      if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      }
      if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = "Password must contain at least one uppercase letter";
      }
      if (!/[a-z]/.test(formData.password)) {
        newErrors.password = "Password must contain at least one lowercase letter";
      }
      if (!/\d/.test(formData.password)) {
        newErrors.password = "Password must contain at least one number";
      }
      if (!Array.from(formData.password).some((char) => '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?'.includes(char))) {
        newErrors.password = "Password must contain at least one special character";
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignUp = async (googleData) => {
    setFormData(prev => ({
      ...prev,
      email: googleData.email,
      fullName: googleData.fullName,
    }));

    const nextErrors = {};
    const selectedRole = formData.role;

    if (!selectedRole) {
      nextErrors.role = "Choose Complainant or Office Handler before completing Google signup";
    }

    if (selectedRole === 'complainant' && !formData.complainantType) {
      nextErrors.complainantType = "Complainant type is required for Google signup";
    }

    if (selectedRole === 'office_handler' && !formData.office) {
      nextErrors.office = "Office selection is required for Google signup";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...nextErrors }));
      Swal.fire({
        icon: 'info',
        title: 'Complete Profile Details',
        text: 'Your Google name and email were filled in. Please choose the required role details, then click Google signup again.',
        confirmButtonColor: '#3085d6',
      });
      return false;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const setupResult = selectedRole === 'complainant'
        ? await authService.completeGoogleComplainantSetup(googleData.token, formData.complainantType)
        : await authService.completeGoogleOfficeSetup(googleData.token, formData.office);

      if (!setupResult.success) {
        const title =
          setupResult.status === 'ROLE_MISMATCH'
            ? 'Role Mismatch'
            : setupResult.status === 'ALREADY_COMPLETED' || setupResult.status === 'ALREADY_APPROVED'
              ? 'Account Exists'
              : setupResult.status === 'BLOCKED'
                ? 'Account Blocked'
                : 'Google Signup Failed';

        Swal.fire({
          icon: setupResult.status === 'ALREADY_COMPLETED' || setupResult.status === 'ALREADY_APPROVED' ? 'info' : 'error',
          title,
          text: setupResult.message || 'Unable to complete Google signup.',
          confirmButtonColor: setupResult.status === 'ALREADY_COMPLETED' || setupResult.status === 'ALREADY_APPROVED' ? '#3085d6' : '#d33',
        });
        return false;
      }

      if (selectedRole === 'office_handler') {
        authService.logout();
        await Swal.fire({
          icon: 'info',
          title: 'Account Pending Approval',
          html: '<div style="text-align:left">Your office handler account request has been submitted and is pending verification by the superadmin.<br><br>You will receive an email once your account is approved or rejected.</div>',
          confirmButtonText: 'OK',
          allowOutsideClick: false,
        });
        navigate('/pending-verification');
        return false;
      }

      authService.setToken(setupResult.token);
      authService.setUser(setupResult.user);

      await Swal.fire({
        icon: 'success',
        title: setupResult.status === 'SUCCESS_NEW_USER' ? 'Account Created!' : 'Profile Completed!',
        text: 'Your Google account is ready. Redirecting...',
        timer: 2000,
        showConfirmButton: false,
      });

      navigate(getDashboardRouteForRole(setupResult.user.role));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'role' && !normalizedAllowedRoles.includes(value) ? formData.role : value;

    setFormData(prev => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'role' && nextValue !== 'office_handler' ? { office: '' } : {}),
      ...(name === 'role' && nextValue !== 'complainant' ? { complainantType: '' } : {})
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const formatOfficeCategoryOption = (office) => {
    const college = String(office?.college || office?.name || '').trim();
    const department = String(office?.department || '').trim();
    const level = department ? 'Department-level' : 'College-level';
    return department ? `${college} - ${department} (${level})` : `${college} (${level})`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recaptchaToken) {
      setErrors(prev => ({
        ...prev,
        recaptcha: "Please verify that you are not a robot"
      }));
      return;
    }
    if (validateForm()) {
      setIsLoading(true);
      setErrors({});

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          office: formData.office || null,
          complainantType: formData.role === 'complainant' ? formData.complainantType : null,
          recaptchaToken: recaptchaToken,
        });

        if (response.data.success) {
          const userWithVerified = {
            ...response.data.user,
            isVerified: response.data.user.isVerified === true
          };
          authService.setToken(response.data.token);
          authService.setUser(userWithVerified);

          if (formData.role === 'complainant') {
            Swal.fire({
              icon: 'success',
              title: 'Account Created!',
              text: 'Your account has been created successfully. Redirecting...',
              timer: 2000,
              showConfirmButton: false
            }).then(() => {
              navigate(getDashboardRouteForRole(response.data.user.role));
            });
          } else if (formData.role === 'office_handler') {
            Swal.fire({
              icon: 'info',
              title: 'Account Pending Verification',
              html: '<div style="text-align:left">Your office handler account has been created and is pending verification by the superadmin.<br><br>You will receive an email once your account is approved or rejected.</div>',
              confirmButtonText: 'OK',
              allowOutsideClick: false
            }).then(() => {
              navigate('/pending-verification');
            });
          }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Signup failed';
        setErrors({ general: errorMessage });

        Swal.fire({
          icon: 'error',
          title: 'Signup Failed',
          text: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-md mx-auto">
          <p className="text-sm text-blue-800 font-medium">Role Information:</p>
          <ul className="text-xs text-blue-700 mt-2 space-y-1">
            {normalizedAllowedRoles.includes('complainant') && (
              <li>- <strong>Complainant</strong>: File complaints and track progress</li>
            )}
            {normalizedAllowedRoles.includes('office_handler') && (
              <li>- <strong>Office Handler</strong>: Review and process complaints</li>
            )}
            <li className="text-orange-600">- Administrator accounts are created by system admins</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Full Name
          </label>
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            value={formData.fullName}
            onChange={handleInputChange}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              errors.fullName 
                ? "border-red-500 focus:ring-red-500" 
                : "border-gray-300 focus:ring-blue-500"
            } text-gray-900 placeholder-gray-500`}
            placeholder="Enter your full name"
          />
          {errors.fullName && (
            <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={formData.email}
            onChange={handleInputChange}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              errors.email 
                ? "border-red-500 focus:ring-red-500" 
                : "border-gray-300 focus:ring-blue-500"
            } text-gray-900 placeholder-gray-500`}
            placeholder="Enter your email"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {roleSelectionLocked ? (
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Role
            </label>
            <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
              {ROLE_LABELS[formData.role] || 'Selected Role'}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              This registration page is reserved for {ROLE_LABELS[formData.role]?.toLowerCase() || 'authorized'} accounts.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                errors.role 
                  ? "border-red-500 focus:ring-red-500" 
                  : "border-gray-300 focus:ring-blue-500"
              } text-gray-900 bg-white`}
            >
              <option value="">Select your role</option>
              {normalizedAllowedRoles.includes('complainant') && (
                <option value="complainant">Complainant</option>
              )}
              {normalizedAllowedRoles.includes('office_handler') && (
                <option value="office_handler">Office Handler</option>
              )}
            </select>
            {errors.role && (
              <p className="text-red-500 text-xs mt-1">{errors.role}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Note: Administrator accounts are created by system admins only
            </p>
          </div>
        )}

        {formData.role === 'office_handler' && (
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Office/Department
            </label>
            <select
              name="office"
              value={formData.office}
              onChange={handleInputChange}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                errors.office 
                  ? "border-red-500 focus:ring-red-500" 
                  : "border-gray-300 focus:ring-blue-500"
              } text-gray-900 bg-white`}
            >
              <option value="">Select your office/department</option>
              {officeCategories.map((office) => (
                <option key={office.id} value={office.id}>{formatOfficeCategoryOption(office)}</option>
              ))}
            </select>
            {errors.office && (
              <p className="text-red-500 text-xs mt-1">{errors.office}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Select the office where you'll be filing complaints
            </p>
          </div>
        )}

        {formData.role === 'complainant' && (
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Complainant Type
            </label>
            <select
              name="complainantType"
              value={formData.complainantType}
              onChange={handleInputChange}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                errors.complainantType
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              } text-gray-900 bg-white`}
            >
              <option value="">Select your type</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="parent">Parent</option>
            </select>
            {errors.complainantType && (
              <p className="text-red-500 text-xs mt-1">{errors.complainantType}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              This classifies your complainant account as student, staff, or parent.
            </p>
          </div>
        )}

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleInputChange}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              errors.password 
                ? "border-red-500 focus:ring-red-500" 
                : "border-gray-300 focus:ring-blue-500"
            } text-gray-900 placeholder-gray-500`}
            placeholder="Create a strong password"
          />
          <PasswordStrengthIndicator password={formData.password} />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
              errors.confirmPassword 
                ? "border-red-500 focus:ring-red-500" 
                : "border-gray-300 focus:ring-blue-500"
            } text-gray-900 placeholder-gray-500`}
            placeholder="Confirm your password"
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="my-4 flex h-[70px] items-center justify-center overflow-hidden sm:h-auto sm:overflow-visible">
          <div className="origin-center scale-[0.86] sm:scale-100">
            <ReCAPTCHA
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              onChange={(token) => setRecaptchaToken(token)}
            />
          </div>
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
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 transition duration-300 shadow-lg hover:shadow-blue-500/30 focus:ring-4 focus:ring-blue-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Account...
            </div>
          ) : (
            "Create Account"
          )}
        </button>
      </form>


      <div className="text-center pt-4">
        <p className="text-gray-600 text-sm">
          Already have an account?{" "}
          <button
            type="button"
            className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors"
            onClick={() => window.location.href = "/"}
          >
            Sign In
          </button>
        </p>
      </div>



      <div className="relative pt-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or sign up with</span>
        </div>
      </div>

      <GoogleSignUpButton onGoogleSignUp={handleGoogleSignUp} buttonText="Sign up with Google" context="signup" />
    </div>
  );
}

export default SignupForm;

import LoginForm from "../auth/components/LoginForm";

function AuthPage() {

  return (
    <div className="min-h-screen w-screen bg-[#0A1A3F] flex items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 md:p-10">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
            LOGO
          </div>
        </div>

        {/* Head Text */}
        <h1 className="text-2xl font-bold text-center text-gray-800">
          SUC Grievance System
        </h1>

        {/* Subtext */}
        <p className="text-center text-gray-500 mt-1 mb-6">
          PNLP-Powered Complaint Management Platform
        </p>

        {/* Login Header */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-gray-800">Login to Your Account</h2>
          <p className="text-gray-600 mt-1">Select your role to continue</p>
        </div>

        {/* Login Form */}
        <LoginForm />
      </div>
    </div>
  );
}

export default AuthPage;

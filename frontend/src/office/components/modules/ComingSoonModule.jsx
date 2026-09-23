export const ComingSoonModule = ({ moduleName }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
      <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        {moduleName ? `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Module` : 'Module'}
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        This module is currently under development. Our team is working hard to bring you this feature soon!
      </p>
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
          Notify Me
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};
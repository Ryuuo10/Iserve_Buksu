const ComingSoonModule = ({ moduleName }) => {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl shadow-lg border border-gray-200 p-16 text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full opacity-10 transform translate-x-20 -translate-y-20"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-15 transform -translate-x-16 translate-y-16"></div>
      
      <div className="relative z-10">
        <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl animate-pulse">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600 text-lg max-w-md mx-auto mb-8">{moduleName} section is currently under development. We're working hard to bring you amazing features!</p>
        
        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModule;
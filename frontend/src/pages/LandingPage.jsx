import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../auth/components/LoginForm';

const LandingPage = () => {
  const navigate = useNavigate();
  const loginPanelRef = useRef(null);

  const scrollToLogin = () => {
    loginPanelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    loginPanelRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 xs:h-14 sm:h-16">
            <div className="flex items-center min-w-0 flex-shrink-0">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center mr-1.5 xs:mr-2 sm:mr-4">
                <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
              <div className="flex-shrink min-w-0 overflow-hidden">
                <h1 className="text-xs xs:text-sm sm:text-base md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate whitespace-nowrap">
                  I-Serve Grievance Chatbot
                </h1>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Left-aligned Content */}
      <section className="min-h-screen flex items-center px-1 xs:px-2 sm:px-4 md:px-6 lg:px-8 relative overflow-hidden w-full bg-cover bg-center bg-no-repeat" 
               style={{ 
                 minHeight: 'calc(100vh - 3rem)',
                 backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url(https://images.unsplash.com/photo-1531482615713-2afd69097998?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80)'
               }}>
        
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 py-8 xs:py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-10 xl:gap-14">
          <div className="grid w-full min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 xl:gap-12">
          {/* Text Content - Center-aligned on mobile, Left-aligned on desktop */}
          <div className="w-full max-w-2xl text-center lg:text-left">
            <div className="space-y-3 xs:space-y-4 sm:space-y-6">
              <div className="inline-flex items-center px-2 py-1 xs:px-3 xs:py-1.5 sm:px-4 sm:py-2 bg-blue-600/15 border border-blue-600/30 rounded-full mx-auto lg:mx-0">
                <span className="w-1 h-1 xs:w-1.5 xs:h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full mr-1 xs:mr-1.5 sm:mr-2 animate-pulse flex-shrink-0"></span>
                <span className="text-blue-700 text-[10px] xs:text-xs sm:text-sm font-medium whitespace-nowrap"> Chatbot Grievance Management</span>
              </div>
              
              <div className="text-center lg:text-left">
                <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-tight">
                  <span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-1 xs:mb-1.5 sm:mb-2">Streamlined</span>
                  <span className="block bg-gradient-to-r from-blue-700 via-cyan-600 to-teal-600 bg-clip-text text-transparent mb-1 xs:mb-1.5 sm:mb-2">
                    Grievance
                  </span>
                  <span className="block bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Management</span>
                </h1>
              </div>
              
              <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-800 max-w-2xl leading-relaxed text-center lg:text-left mx-auto lg:mx-0">
                Efficiently handle and resolve grievances within Bukidnon State University with our 
                <span className="text-blue-700 font-semibold"> chatbot</span> system for efficient grievance management.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 xs:gap-3 sm:gap-4 mt-4 xs:mt-6 sm:mt-8">
                <button
                  onClick={scrollToLogin}
                  className="group px-4 py-2 xs:px-6 xs:py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center sm:justify-start border border-blue-500/20 hover:border-blue-400/30 text-xs xs:text-sm sm:text-base whitespace-nowrap"
                >
                  Get Started
                  <svg className="ml-1 xs:ml-1.5 sm:ml-2 w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 group-hover:translate-x-0.5 xs:group-hover:translate-x-0.5 sm:group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Phone Animation - Right Side (Centered) */}
          <div className="flex w-full justify-center lg:justify-center">
            <div className="relative max-w-full">
              {/* Floating Elements */}
              <div className="absolute -top-4 -left-4 xs:-top-6 xs:-left-6 sm:-top-8 sm:-left-8 w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 bg-blue-400/25 rounded-full animate-ping"></div>
              <div className="absolute -bottom-4 -right-4 xs:-bottom-6 xs:-right-6 sm:-bottom-8 sm:-right-8 w-10 h-10 xs:w-12 xs:h-12 sm:w-16 sm:h-16 bg-cyan-400/25 rounded-full animate-pulse"></div>
              <div className="absolute top-1/2 -right-6 xs:-right-8 sm:-right-12 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 bg-purple-400/25 rounded-full animate-bounce"></div>
              
              {/* Additional Floating Elements */}
              <div className="absolute top-1/4 -left-6 xs:-left-8 sm:-left-12 w-8 h-8 xs:w-10 xs:h-10 sm:w-14 sm:h-14 bg-teal-400/20 rounded-full animate-pulse delay-300"></div>
              <div className="absolute bottom-1/3 -right-8 xs:-right-10 sm:-right-16 w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 bg-indigo-400/20 rounded-full animate-bounce delay-700"></div>
              <div className="absolute -top-2 xs:-top-3 sm:-top-4 right-1/3 w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 bg-pink-400/20 rounded-full animate-ping delay-1000"></div>
              <div className="absolute bottom-4 xs:bottom-6 sm:bottom-8 left-1/4 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 bg-yellow-400/20 rounded-full animate-pulse delay-500"></div>
              
              {/* New Additional Floating Elements */}
              <div className="absolute top-1/3 -left-10 xs:-left-12 sm:-left-16 w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 bg-green-400/20 rounded-full animate-bounce delay-200"></div>
              <div className="absolute bottom-1/4 -right-10 xs:-right-12 sm:-right-16 w-7 h-7 xs:w-9 xs:h-9 sm:w-11 sm:h-11 bg-red-400/20 rounded-full animate-ping delay-400"></div>
              <div className="absolute top-2/3 -left-8 xs:-left-10 sm:-left-12 w-5 h-5 xs:w-7 xs:h-7 sm:w-9 sm:h-9 bg-orange-400/20 rounded-full animate-pulse delay-600"></div>
              <div className="absolute -top-6 xs:-top-8 sm:-top-10 right-1/4 w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 bg-violet-400/20 rounded-full animate-bounce delay-800"></div>
              <div className="absolute bottom-1/5 left-1/3 w-7 h-7 xs:w-9 xs:h-9 sm:w-11 sm:h-11 bg-rose-400/20 rounded-full animate-ping delay-900"></div>
              
              {/* Phone Frame */}
              <div className="relative w-32 h-[300px] xs:w-40 xs:h-[350px] sm:w-48 sm:h-[400px] md:w-56 md:h-[450px] lg:w-64 lg:h-[500px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[1.5rem] xs:rounded-[2rem] sm:rounded-[2.5rem] md:rounded-[3rem] border-2 xs:border-4 sm:border-6 md:border-8 border-gray-700 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500 mx-auto max-w-full">
                {/* Screen */}
                <div className="absolute inset-2 xs:inset-3 sm:inset-4 bg-gradient-to-b from-blue-50 to-blue-100 rounded-[1rem] xs:rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
                  {/* Chat Interface */}
                  <div className="h-full flex flex-col p-2 xs:p-3 sm:p-4">
                    {/* Chat Header */}
                    <div className="flex items-center mb-2 xs:mb-3 sm:mb-4 p-1.5 xs:p-2 sm:p-3 bg-blue-600/25 backdrop-blur-sm rounded-xl border border-blue-500/40">
                      <div className="w-1.5 h-1.5 xs:w-2 xs:h-2 sm:w-3 sm:h-3 rounded-full bg-green-600 mr-1.5 xs:mr-2 sm:mr-3 animate-pulse flex-shrink-0"></div>
                      <div className="min-w-0 overflow-hidden">
                        <h3 className="text-xs xs:text-sm sm:text-base text-gray-900 font-semibold truncate">I-Serve Assistant</h3>
                        <p className="text-[10px] xs:text-xs sm:text-sm text-blue-700 truncate">Always Available</p>
                      </div>
                    </div>
                    
                    {/* Chat Messages */}
                    <div className="flex-1 space-y-2 xs:space-y-3 sm:space-y-4 mb-2 xs:mb-3 sm:mb-4 overflow-y-auto">
                      {/* Bot Message */}
                      <div className="flex justify-start">
                        <div className="bg-blue-600 backdrop-blur-sm text-white rounded-2xl rounded-tl-none px-2 py-1.5 xs:px-3 xs:py-2 sm:px-4 sm:py-3 max-w-[80%] border border-blue-500/40 animate-fade-in">
                          <p className="text-[10px] xs:text-xs sm:text-sm">Hello! How can I help you with your grievance today? I'm here 24/7 to assist you.</p>
                        </div>
                      </div>
                      
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-gray-300 backdrop-blur-sm text-gray-900 rounded-2xl rounded-tr-none px-2 py-1.5 xs:px-3 xs:py-2 sm:px-4 sm:py-3 max-w-[80%] border border-gray-400/40 animate-fade-in-delay">
                          <p className="text-[10px] xs:text-xs sm:text-sm">I need to file a complaint about my grades.</p>
                        </div>
                      </div>
                      
                      {/* Bot Message */}
                      <div className="flex justify-start">
                        <div className="bg-blue-600 backdrop-blur-sm text-white rounded-2xl rounded-tl-none px-2 py-1.5 xs:px-3 xs:py-2 sm:px-4 sm:py-3 max-w-[80%] border border-blue-500/40 animate-fade-in-delay-2">
                          <p className="text-[10px] xs:text-xs sm:text-sm">I can help you with that. Let me guide you through our secure complaint process step by step.</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Input Area */}
                    <div className="flex items-center bg-gray-200 backdrop-blur-sm rounded-xl p-1.5 xs:p-2 sm:p-3 border border-gray-300/40">
                      <input 
                        type="text" 
                        placeholder="Type your message..." 
                        className="flex-1 bg-transparent text-gray-900 placeholder-gray-600 outline-none text-[10px] xs:text-xs sm:text-sm min-w-0"
                        readOnly
                      />
                      <button className="ml-1 xs:ml-1.5 sm:ml-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-full p-1 xs:p-1.5 sm:p-2 transition-all duration-300 transform hover:scale-110 border border-blue-400/30 hover:border-blue-300/40 flex-shrink-0">
                        <svg className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Home Button */}
                <div className="absolute bottom-2 xs:bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                  <div className="w-4 h-4 xs:w-6 xs:h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-gray-700 to-gray-900"></div>
                </div>
                
                {/* Camera Notch */}
                <div className="absolute top-3 xs:top-4 sm:top-6 left-1/2 transform -translate-x-1/2 w-16 h-4 xs:w-20 xs:h-5 sm:w-24 sm:h-6 md:w-32 md:h-6 bg-gray-800 rounded-full"></div>
              </div>
            </div>
          </div>
          </div>

          <aside
            ref={loginPanelRef}
            id="login-panel"
            tabIndex={-1}
            className="scroll-mt-20 w-full max-w-md justify-self-center rounded-[28px] border border-white/30 bg-white/95 p-5 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md outline-none sm:p-6 lg:max-w-none"
          >
            <div className="mb-5 border-b border-slate-200 pb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Unified Access</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">Login to I-Serve</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Sign in and the system will open the correct dashboard for your role.
              </p>
            </div>
            <LoginForm onSignupClick={() => navigate('/auth')} />
          </aside>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 xs:py-12 sm:py-16 md:py-20 px-1 xs:px-2 sm:px-4 md:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto w-full px-1 xs:px-2">
          <div className="text-center mb-8 xs:mb-12 sm:mb-16 px-1 xs:px-2">
            <div className="inline-flex items-center px-2 py-1 xs:px-3 xs:py-1.5 sm:px-4 sm:py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-3 xs:mb-4 sm:mb-6 mx-auto">
              <span className="text-blue-300 text-xs xs:text-sm sm:text-base font-medium">Features</span>
            </div>
            <h2 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3 xs:mb-4 sm:mb-6 px-1 xs:px-2">
              Everything you need to manage grievances
            </h2>
            <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto px-1 xs:px-2">
              Our comprehensive platform provides all the tools needed for efficient grievance resolution
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-6 sm:gap-8 px-1 xs:px-2">
            <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-4 xs:p-6 sm:p-8 border border-white/10 hover:border-blue-500/30 transition-all duration-300 hover:bg-white/10 hover:-translate-y-0.5 sm:hover:-translate-y-1 w-full">
              <div className="flex items-center justify-center w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto mb-4 xs:mb-6 sm:mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-2 xs:mb-3 sm:mb-4 text-center">Secure</h3>
              <p className="text-gray-300 text-sm xs:text-base sm:text-lg text-center leading-relaxed px-1 xs:px-2">
                Your grievances are handled with complete privacy and security through role-based access controls.
              </p>
            </div>
            
            <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-4 xs:p-6 sm:p-8 border border-white/10 hover:border-blue-500/30 transition-all duration-300 hover:bg-white/10 hover:-translate-y-0.5 sm:hover:-translate-y-1 w-full">
              <div className="flex items-center justify-center w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto mb-4 xs:mb-6 sm:mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-2 xs:mb-3 sm:mb-4 text-center">Fast Resolution</h3>
              <p className="text-gray-300 text-sm xs:text-base sm:text-lg text-center leading-relaxed px-1 xs:px-2">
                Quick processing and timely resolution of all grievances with automated workflows.
              </p>
            </div>
            
            <div className="group bg-white/5 backdrop-blur-sm rounded-2xl p-4 xs:p-6 sm:p-8 border border-white/10 hover:border-blue-500/30 transition-all duration-300 hover:bg-white/10 hover:-translate-y-0.5 sm:hover:-translate-y-1 w-full">
              <div className="flex items-center justify-center w-12 h-12 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto mb-4 xs:mb-6 sm:mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg xs:text-xl sm:text-2xl font-bold text-white mb-2 xs:mb-3 sm:mb-4 text-center">Transparent Tracking</h3>
              <p className="text-gray-300 text-sm xs:text-base sm:text-lg text-center leading-relaxed px-1 xs:px-2">
                Real-time status updates and progress tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/30 backdrop-blur-sm border-t border-white/10 py-8 xs:py-12 sm:py-16 w-full">
        <div className="max-w-7xl mx-auto px-1 xs:px-2 sm:px-4 md:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 gap-6 xs:gap-8 sm:gap-12 md:grid-cols-3 px-1 xs:px-2">
            <div className="text-center">
              <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-3 xs:mb-4 sm:mb-6">
                I-Serve Grievance Chatbot
              </h3>
              <p className="text-gray-400 text-sm xs:text-base sm:text-lg max-w-xs mx-auto px-1 xs:px-2">
                Secure and efficient grievance management for State Universities and Colleges.
              </p>
            </div>
            <div className="text-center">
              <h4 className="text-base xs:text-lg sm:text-xl font-semibold text-white mb-3 xs:mb-4 sm:mb-6">Quick Links</h4>
              <ul className="space-y-1 xs:space-y-2 sm:space-y-3">
                <li>
                  <button 
                    onClick={() => navigate('/auth')}
                    className="text-gray-400 hover:text-blue-400 transition-colors text-sm xs:text-base sm:text-lg"
                  >
                    File a Complaint
                  </button>
                </li>
              </ul>
            </div>
            <div className="text-center">
              <h4 className="text-base xs:text-lg sm:text-xl font-semibold text-white mb-3 xs:mb-4 sm:mb-6">Contact</h4>
              <div className="text-gray-400 text-sm xs:text-base sm:text-lg space-y-1 xs:space-y-2 sm:space-y-3">
                <p>support@suc-grievance.edu</p>
                <p>+1 (555) 123-4567</p>
                <p>24/7 Support Available</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 xs:mt-12 sm:mt-16 pt-6 xs:pt-8 sm:pt-10 text-center px-1 xs:px-2">
            <p className="text-gray-500 text-sm xs:text-base sm:text-lg">
              © {new Date().getFullYear()} I-Serve Grievance Chatbot. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

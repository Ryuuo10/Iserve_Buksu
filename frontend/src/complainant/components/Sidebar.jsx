import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import authService from '../../services/authService';
import LogoutModal from './LogoutModal';
import { 
  DashboardIcon, 
  DocumentIcon, 
  UsersIcon, 
  BellIcon, 
  SettingsIcon, 
  LogoutIcon 
} from '../icons';

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await authService.getProfile();
        if (response.success) {
          setUserInfo(response.user);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  // Click outside handler for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileDropdownOpen]);

  const handleLogout = () => {
    // Save current user work/state before showing modal
    saveUserWork();
    setShowLogoutModal(true);
  };

  const saveUserWork = () => {
    // Save any unsaved work/data to localStorage/sessionStorage
    const currentTime = new Date().toISOString();
    
    // Save current chat state if exists
    const chatMessages = localStorage.getItem('chatMessages');
    if (chatMessages) {
      localStorage.setItem(`savedChat_${currentTime}`, chatMessages);
    }
    
    // Save form data if any forms are active
    const formData = sessionStorage.getItem('currentFormData');
    if (formData) {
      localStorage.setItem(`savedFormData_${currentTime}`, formData);
    }
    
    // Save current active tab/state
    localStorage.setItem('lastActiveTab', activeTab);
    localStorage.setItem('sessionEndTime', currentTime);
    
    console.log('User work saved successfully at:', currentTime);
  };

  const confirmLogout = () => {
    // Stop all ongoing processes and save final state
    stopUserSession();
    
    // Clear authentication tokens
    authService.logout();
    sessionStorage.clear();
    
    // Close modal and redirect
    setShowLogoutModal(false);
    navigate('/');
  };

  const stopUserSession = () => {
    // Clear any active intervals/timers
    const activeTimers = JSON.parse(localStorage.getItem('activeTimers') || '[]');
    activeTimers.forEach(timerId => {
      clearInterval(timerId);
      clearTimeout(timerId);
    });
    
    // Mark session as officially ended
    const endTime = new Date().toISOString();
    localStorage.setItem('sessionStatus', 'ended');
    localStorage.setItem('sessionEndTimestamp', endTime);
    
    // Log session end for analytics
    console.log('User session stopped at:', endTime);
  };

  const cancelLogout = () => {
    // Resume normal operation
    setShowLogoutModal(false);
  };

  const navigationItems = [
    { id: 'dashboard', name: 'I-Serve Chatbot', icon: DashboardIcon },
    { id: 'my-grievances', name: 'Manage Grievance', icon: DocumentIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 border-r border-gray-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 group">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-all duration-300 group-hover:scale-110">
                <svg className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="font-heading-xs text-white group-hover:text-white transition-colors duration-300">I-Serve Chatbot</h1>
                <p className="font-body-xs text-blue-100 group-hover:text-blue-50 transition-colors duration-300">Grievance Management</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-2">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                        activeTab === item.id
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105"
                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 transition-all duration-300 ${
                        activeTab === item.id
                          ? "text-white scale-110"
                          : "text-gray-500 group-hover:text-blue-600 group-hover:scale-110"
                      }`}>
                        <IconComponent />
                      </div>
                      <span className={`font-label-md transition-all duration-300 ${
                        activeTab === item.id
                          ? "text-white"
                          : "text-gray-700 group-hover:text-blue-700"
                      }`}>{item.name}</span>
                    </button>
                  </li>
                );
              })}
              {/* Superadmin-only Admin Management link */}
              {userInfo?.role === 'superadmin' && (
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('admin-management');
                      setSidebarOpen(false);
                      navigate('/admin');
                    }}
                    className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-300 group text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 text-gray-500 group-hover:text-blue-600`}>
                      <UsersIcon />
                    </div>
                    <span className={`font-label-md text-gray-700 group-hover:text-blue-700`}>Admin Management</span>
                  </button>
                </li>
              )}
            </ul>
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200" ref={profileRef}>
            <div 
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors duration-200"
              onClick={() => {
                console.log('Profile clicked, current state:', profileDropdownOpen);
                setProfileDropdownOpen(!profileDropdownOpen);
              }}
            >
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {loading ? (
                  <div className="w-6 h-6 bg-white/30 rounded-full animate-pulse"></div>
                ) : userInfo?.name ? (
                  userInfo.name.charAt(0).toUpperCase()
                ) : (
                  'C'
                )}
              </div>
              <div className="flex-1 min-w-0">
                {loading ? (
                  <>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                  </>
                ) : userInfo ? (
                  <>
                    <p className="font-label-sm text-gray-900 truncate">{userInfo.name || 'Complainant User'}</p>
                    <p className="font-body-xs text-gray-500 truncate">{userInfo.email || 'complainant@example.com'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-label-sm text-gray-900 truncate">Complainant User</p>
                    <p className="font-body-xs text-gray-500 truncate">complainant@example.com</p>
                  </>
                )}
              </div>
              <div className={`transform transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`}>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {/* Profile Dropdown Menu */}
            <div className="relative">
              {profileDropdownOpen && (
                <div className="fixed bottom-24 left-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* User Info Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xl">
                        {loading ? (
                          <div className="w-6 h-6 bg-white/30 rounded-full animate-pulse"></div>
                        ) : userInfo?.name ? (
                          userInfo.name.charAt(0).toUpperCase()
                        ) : (
                          'C'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {loading ? (
                          <>
                            <div className="h-4 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                          </>
                        ) : userInfo ? (
                          <>
                            <p className="font-label-md text-gray-900 truncate">{userInfo.name || 'Complainant User'}</p>
                            <p className="font-body-sm text-gray-500 truncate">{userInfo.email || 'complainant@example.com'}</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              {userInfo.role?.replace('_', ' ').toUpperCase() || 'COMPLAINANT'}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="font-label-md text-gray-900 truncate">Complainant User</p>
                            <p className="font-body-sm text-gray-500 truncate">complainant@example.com</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              COMPLAINANT
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="py-2">
                    <button 
                      onClick={() => {
                        setActiveTab('profile');
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Profile Settings</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setActiveTab('account-settings');
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Account Settings</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setActiveTab('help-support');
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Help & Support</span>
                    </button>
                    
                    <div className="border-t border-gray-100 my-2"></div>
                    
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 flex items-center space-x-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Logout Confirmation Modal */}
      <LogoutModal 
        isOpen={showLogoutModal}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
      />
    </>
  );
};

export default Sidebar;

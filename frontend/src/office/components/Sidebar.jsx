import { useState, useEffect, useRef } from 'react';
import authService from '../../services/authService';
import { LogoutModal } from './LogoutModal';
import { getLoginRouteForRole } from '../../utils/authRoutes';
import { 
  DashboardIcon as HomeIcon, 
  DocumentIcon as DocumentTextIcon, 
  ChartIcon as ChartBarIcon
} from "../icons";

const navigationItems = [
  { id: "dashboard", name: "Dashboard", icon: HomeIcon },
  { id: "grievances", name: "My Grievances", icon: DocumentTextIcon },
  { id: "resolution-reports", name: "Resolution Reports", icon: ChartBarIcon }
];

export const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
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

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (!event.detail) {
        return;
      }

      setUserInfo((prev) => ({
        ...(prev || {}),
        ...event.detail,
      }));
    };

    window.addEventListener('auth-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('auth-profile-updated', handleProfileUpdated);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);
  
  const handleLogout = async () => {
    try {
      await authService.logout();
      setLogoutModalOpen(false);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  console.log('Sidebar rendered with sidebarOpen:', sidebarOpen);
  console.log('CSS classes would be:', `fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`);
  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ zIndex: 40 }}
        ></div>
      )}
      
      {/* Logout Modal */}
      <LogoutModal 
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out sidebar ${sidebarOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full'}`} style={{ zIndex: 50 }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">I-Serve Chatbot</h1>
                <p className="text-blue-100 text-xs">Grievance Management</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
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
                    : "text-gray-400 group-hover:text-blue-600 group-hover:scale-105"
                }`}>
                  <item.icon />
                </div>
                <span className="font-semibold text-sm tracking-wide group-hover:translate-x-1 transition-transform duration-300">
                  {item.name}
                </span>
              </button>
            ))}
          </nav>

          {/* User Profile Dropdown */}
          <div className="p-4 border-t border-gray-200">
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-full flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </>
                  ) : userInfo ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 truncate text-left">{userInfo.name || 'Office Staff'}</p>
                      <p className="text-xs text-gray-500 truncate text-left">{userInfo.email || 'office@example.com'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900 truncate text-left">Office Staff</p>
                      <p className="text-xs text-gray-500 truncate text-left">office@example.com</p>
                    </>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10" style={{width: '240px'}}>
                  {/* User Info Header */}
                  <div className="px-3 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        {userInfo ? (
                          <>
                            <p className="text-sm font-semibold text-gray-900 truncate">{userInfo.name || 'Office Staff'}</p>
                            <p className="text-xs text-gray-500 truncate">{userInfo.email || 'office@example.com'}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-900 truncate">Office Staff</p>
                            <p className="text-xs text-gray-500 truncate">office@example.com</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                      OFFICE_STAFF
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileMenu(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">Profile Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setShowProfileMenu(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">Account Settings</span>
                    </button>
                    <button
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">Help & Support</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setLogoutModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

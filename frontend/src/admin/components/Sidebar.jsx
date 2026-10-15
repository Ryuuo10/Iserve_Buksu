import { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import authService from '../../services/authService';
import LogoutModal from './LogoutModal';
import { getLoginRouteForRole } from '../../utils/authRoutes';
import { canAccessAdminTab } from '../../utils/adminPermissions';
import { 
  DashboardIcon, 
  DocumentIcon, 
  UsersIcon, 
  BuildingIcon, 
  ChartIcon, 
  SettingsIcon, 
  LogoutIcon 
} from '../icons';

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, userInfo: initialUserInfo = null }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(initialUserInfo || authService.getUser());
  const [loading, setLoading] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const profileRef = useRef(null);
  
  useEffect(() => {
    if (initialUserInfo) {
      setUserInfo(initialUserInfo);
      setLoading(false);
      return;
    }

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
  }, [initialUserInfo]);

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

  const handleLogout = async () => {
    try {
      await authService.logout();
      setLogoutModalOpen(false);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigateToAdminTab = (tabId) => {
    setSidebarOpen(false);

    if (window.location.pathname === '/admin-manage') {
      navigate('/admin', { state: { activeTab: tabId } });
      return;
    }

    setActiveTab(tabId);
  };
  
  // Get navigation items based on user role
  const getNavigationItems = () => {
    const allModules = [
      { id: 'dashboard', name: 'Dashboard', icon: DashboardIcon, color: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-500/10' },
      { id: 'grievances', name: 'Grievance Manage', icon: DocumentIcon, color: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-500/10' },
      { id: 'users', name: 'Manage User', icon: UsersIcon, color: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-500/10' },
      { id: 'offices', name: 'Office Manage', icon: BuildingIcon, color: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-500/10' },
      { id: 'analytics', name: 'Analytics', icon: ChartIcon, color: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-500/10' }
    ];

    return allModules.filter((item) => canAccessAdminTab(userInfo, item.id));
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Logout Modal */}
      <LogoutModal 
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-all duration-300 ease-in-out sidebar ${sidebarOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full'}`}>
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
                <h1 className="text-xl font-bold text-white">
                  {userInfo?.role === 'superadmin' ? 'Superadmin Panel' : 'Admin Portal'}
                </h1>
                <p className="text-blue-100 text-xs">
                  {userInfo?.role === 'superadmin' ? 'System Management' : 'Grievance Management'}
                </p>
              </div>
            </div>
          </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigateToAdminTab(item.id);
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
          
          {/* Admin Manage - Only visible to superadmin */}
          {canAccessAdminTab(userInfo, 'admin-manage') && (
            <button
              onClick={() => {
                navigateToAdminTab('admin-manage');
              }}
              className={`w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                activeTab === 'admin-manage'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105"
                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md"
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 transition-all duration-300 ${
                activeTab === 'admin-manage'
                  ? "text-white scale-110"
                  : "text-gray-400 group-hover:text-blue-600 group-hover:scale-105"
              }`}>
                <SettingsIcon />
              </div>
              <span className="font-semibold text-sm tracking-wide group-hover:translate-x-1 transition-transform duration-300">
                Admin Manage
              </span>
            </button>
          )}
        </nav>

        {/* User Profile - Bottom */}
        <div className="p-4 border-t border-gray-200 relative" ref={profileRef}>
          <div 
            className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors duration-200"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          >
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {loading ? (
                <div className="w-6 h-6 bg-white/30 rounded-full animate-pulse"></div>
              ) : userInfo?.profilePicture ? (
                <img 
                  src={userInfo.profilePicture} 
                  alt={userInfo.name}
                  className="w-full h-full object-cover"
                />
              ) : userInfo?.name ? (
                userInfo.name.charAt(0).toUpperCase()
              ) : (
                'A'
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
                  <p className="text-sm font-semibold text-gray-900 truncate">{userInfo.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500 truncate">{userInfo.email || ''}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">Admin</p>
                  <p className="text-xs text-gray-500 truncate">admin@example.com</p>
                </>
              )}
            </div>
            <div className={`transform transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* Profile Dropdown Menu - Opens upward */}
          {profileDropdownOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
              {/* User Info Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xl overflow-hidden">
                    {userInfo?.profilePicture ? (
                      <img 
                        src={userInfo.profilePicture} 
                        alt={userInfo.name}
                        className="w-full h-full object-cover"
                      />
                    ) : userInfo?.name ? (
                      userInfo.name.charAt(0).toUpperCase()
                    ) : (
                      'A'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userInfo?.name || 'Admin'}</p>
                    <p className="text-xs text-gray-500 truncate">{userInfo?.email || ''}</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      {userInfo?.role?.replace('_', ' ').toUpperCase() || 'ADMIN'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="py-2">
                <button 
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateToAdminTab('profile');
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center space-x-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Profile</span>
                </button>

                <button 
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateToAdminTab('settings');
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 flex items-center space-x-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                </button>
                
                <div className="border-t border-gray-100 my-2"></div>
                
                <button 
                  onClick={() => {
                    setLogoutModalOpen(true);
                    setProfileDropdownOpen(false);
                  }}
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
  </>
  );
};

export default Sidebar;

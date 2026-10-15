import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import authService from "../services/authService";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { DashboardModule, OfficesModule, GrievanceManagementModule, AnalyticsModule, NotificationsModule, AdminManageModule } from "./components/modules";
import UserManagementModule from "./components/modules/UserManagementModule";
import ProfileModule from "./components/modules/ProfileModule";
import SettingsModule from "./components/modules/SettingsModule";
import { canAccessAdminTab, getAccessibleAdminTabs } from "../utils/adminPermissions";
import StaffGrievanceToastContainer from "../components/StaffGrievanceToastContainer";
import CriticalCaseAlerts from "./components/CriticalCaseAlerts";

const ADMIN_SELECTED_GRIEVANCE_KEY = "admin_dashboard_selected_grievance_id";
//taskkill /F /IM node.exe
//Start-Sleep -Seconds 2
function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [criticalCount, setCriticalCount] = useState(0);
  const [caseSelectionVersion, setCaseSelectionVersion] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Check user role on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await authService.getProfile();
        if (response.success) {
          setUserInfo(response.user);
          // Superadmin can now access all modules, no automatic redirect
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [navigate]);

  // Check for passed activeTab from navigation state
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear the state to prevent it from affecting future navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!userInfo) {
      return;
    }

    if (canAccessAdminTab(userInfo, activeTab)) {
      return;
    }

    const [fallbackTab] = getAccessibleAdminTabs(userInfo);
    if (fallbackTab && fallbackTab !== activeTab) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, userInfo]);

  // No automatic closing on resize - sidebar should always be controllable

  // Also close sidebar when clicking outside (for mobile)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.querySelector('.sidebar');
      const menuButton = document.querySelector('.menu-button');
      
      if (sidebar && menuButton && 
          !sidebar.contains(event.target) && 
          !menuButton.contains(event.target) &&
          window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sidebarOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const canViewTab = (tabId) => canAccessAdminTab(userInfo, tabId);

  const handleViewGrievance = (grievanceId) => {
    if (!grievanceId || !canViewTab('grievances')) return;
    if (grievanceId && typeof window !== "undefined") {
      localStorage.setItem(ADMIN_SELECTED_GRIEVANCE_KEY, grievanceId);
    }

    setActiveTab("grievances");
    setCaseSelectionVersion((current) => current + 1);
    setSidebarOpen(false);
  };

  const handleViewNotificationToasts = () => {
    setActiveTab(canViewTab("notifications") ? "notifications" : "grievances");
    setSidebarOpen(false);
  };

  const handleOpenNotification = (notification) => {
    const grievanceId = typeof notification.relatedGrievance === 'string'
      ? notification.relatedGrievance
      : notification.relatedGrievance?._id;
    if (grievanceId && canViewTab('grievances')) {
      handleViewGrievance(grievanceId);
      return;
    }
    if (notification.type === 'office_verification_request' && canViewTab('offices')) {
      setActiveTab('offices');
      setSidebarOpen(false);
      return;
    }
    handleViewNotificationToasts();
  };


  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <StaffGrievanceToastContainer
        role={userInfo?.role}
        onViewGrievance={handleViewGrievance}
        onViewNotifications={handleViewNotificationToasts}
      />
      {canViewTab('grievances') && canViewTab('notifications') && (
        <CriticalCaseAlerts onViewCase={handleViewGrievance} onCountChange={setCriticalCount} />
      )}
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        userInfo={userInfo}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar 
          onOpenNotification={handleOpenNotification}
          criticalCount={criticalCount}
          activeTab={activeTab}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setActiveTab={setActiveTab}
          userInfo={userInfo}
        />
        
        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            {/* Dashboard View */}
            {activeTab === 'dashboard' && canViewTab('dashboard') && <DashboardModule onNavigate={setActiveTab} />}
            
            {/* Offices Management View */}
            {activeTab === 'offices' && canViewTab('offices') && <OfficesModule />}
            
            {/* User Management View */}
            {activeTab === 'users' && canViewTab('users') && <UserManagementModule />}
            
            {/* Grievance Management View */}
            {activeTab === 'grievances' && canViewTab('grievances') && <GrievanceManagementModule key={caseSelectionVersion} />}
            
            {/* Analytics View */}
            {activeTab === 'analytics' && canViewTab('analytics') && <AnalyticsModule />}
            {activeTab === 'notifications' && canViewTab('notifications') && (
              <NotificationsModule onViewGrievance={canViewTab('grievances') ? handleViewGrievance : undefined} />
            )}
            {activeTab === 'admin-manage' && canViewTab('admin-manage') && <AdminManageModule />}
            {activeTab === 'settings' && canViewTab('settings') && <SettingsModule />}
            {activeTab === 'profile' && canViewTab('profile') && <ProfileModule />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;

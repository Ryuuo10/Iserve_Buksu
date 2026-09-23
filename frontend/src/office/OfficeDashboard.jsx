import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DashboardModule, GrievancesModule, ResolutionTimeReportModule, ProfileModule, OfficesModule, NotificationsModule, ComingSoonModule, SettingsModule } from "./components/modules";
import { getOfficePreferences } from "./utils/preferences";
import StaffGrievanceToastContainer from "../components/StaffGrievanceToastContainer";

const OFFICE_SELECTED_GRIEVANCE_KEY = "office_dashboard_selected_grievance_id";

const OfficeDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => getOfficePreferences().defaultTab || "dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  console.log('OfficeDashboard rendered, sidebarOpen:', sidebarOpen);

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

  const renderActiveModule = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardModule onNavigate={setActiveTab} />;
      case "grievances":
        return <GrievancesModule />;
      case "resolution-reports":
        return <ResolutionTimeReportModule />;
      case "profile":
        return <ProfileModule />;
      case "offices":
        return <OfficesModule />;
      case "notifications":
        return <NotificationsModule />;
      case "settings":
        return <SettingsModule />;
      default:
        return <ComingSoonModule moduleName={activeTab} />;
    }
  };

  const handleViewGrievanceToast = (grievanceId) => {
    if (grievanceId && typeof window !== "undefined") {
      localStorage.setItem(OFFICE_SELECTED_GRIEVANCE_KEY, grievanceId);
    }

    setActiveTab("grievances");
    setSidebarOpen(false);
  };

  const handleViewNotificationToasts = () => {
    setActiveTab("notifications");
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <StaffGrievanceToastContainer
        role="office_handler"
        onViewGrievance={handleViewGrievanceToast}
        onViewNotifications={handleViewNotificationToasts}
      />
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar 
          activeTab={activeTab} 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setActiveTab={setActiveTab}
        />
        
        {/* Dashboard Content */}
        <main className={`flex-1 overflow-y-auto ${activeTab === "grievances" ? "p-3 sm:p-4 lg:p-5" : "p-4 sm:p-6 lg:p-8"}`}>
          <div className={activeTab === "grievances" ? "mx-auto w-full max-w-[1680px]" : "max-w-7xl mx-auto"}>
            {renderActiveModule()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default OfficeDashboard;

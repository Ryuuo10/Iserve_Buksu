import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { DashboardModule, MyGrievancesModule, NotificationsModule, ProfileModule } from "./components/modules";
import AccountSettingsModule from "./components/modules/AccountSettingsModule";
import HelpSupportModule from "./components/modules/HelpSupportModule";

const ComplainantDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="flex h-[100dvh] min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
      />
      
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar 
          activeTab={activeTab} 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
          setActiveTab={setActiveTab}
        />
        
        <main className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3 lg:p-4">
          <div className="h-full min-w-0">
            {/* Dashboard View - Full height chatbot */}
            {activeTab === 'dashboard' && <DashboardModule />}
            
            {/* My Grievances View */}
            {activeTab === 'my-grievances' && <MyGrievancesModule />}
            
            {/* Profile View */}
            {activeTab === 'profile' && <ProfileModule />}
            
            {/* Account Settings View */}
            {activeTab === 'account-settings' && <AccountSettingsModule />}
            
            {/* Help & Support View */}
            {activeTab === 'help-support' && <HelpSupportModule />}
            
            {/* Notifications View */}
            {activeTab === 'notifications' && <NotificationsModule />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ComplainantDashboard;

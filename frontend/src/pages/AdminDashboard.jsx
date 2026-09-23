import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";

// Professional SVG Icons
const DashboardIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [offices, setOffices] = useState([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const navigate = useNavigate();

  // Load offices when component mounts
  useEffect(() => {
    loadOffices();
  }, []);

  const loadOffices = async () => {
    setLoadingOffices(true);
    try {
      const result = await authService.getOffices();
      if (result.success) {
        setOffices(result.offices);
      }
    } catch (error) {
      console.error('Failed to load offices:', error);
    } finally {
      setLoadingOffices(false);
    }
  };

  // Example data
  const stats = [
    { name: "Total Grievances", value: "142", change: "+12%", icon: "📊", color: "from-blue-500 to-cyan-500" },
    { name: "Pending Cases", value: "24", change: "+3", icon: "⏳", color: "from-amber-500 to-orange-500" },
    { name: "Resolved Today", value: "8", change: "+2", icon: "✅", color: "from-green-500 to-emerald-500" },
    { name: "Active Users", value: "156", change: "+8%", icon: "👥", color: "from-purple-500 to-violet-500" }
  ];

  const recentActivities = [
    { user: "John Doe", action: "submitted a new grievance", time: "2 minutes ago", type: "complaint" },
    { user: "Sarah Smith", action: "resolved case #1245", time: "15 minutes ago", type: "resolution" },
    { user: "Mike Johnson", action: "updated case status", time: "1 hour ago", type: "update" },
    { user: "Admin Team", action: "system maintenance completed", time: "3 hours ago", type: "system" }
  ];

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 px-4 border-b border-gray-700 bg-slate-900/50">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg ring-2 ring-white/10">
                <BuildingIcon />
              </div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold text-white tracking-tight">I-Serve Grievance Chatbot</h1>
                <p className="text-xs text-blue-300 font-medium">Grievance System</p>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: DashboardIcon },
              { id: 'grievances', name: 'Grievance Management', icon: DocumentIcon },
              { id: 'users', name: 'User Management', icon: UsersIcon },
              { id: 'offices', name: 'Office Management', icon: BuildingIcon },
              { id: 'analytics', name: 'Analytics', icon: ChartIcon },
              { id: 'settings', name: 'Settings', icon: SettingsIcon }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl transition-all duration-200 group ${activeTab === item.id ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-300 hover:bg-slate-700/50 hover:text-white hover:shadow-sm'}`}
              >
                <div className={`flex-shrink-0 w-6 h-6 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-300'}`}>
                  <item.icon />
                </div>
                <span className="font-medium text-sm tracking-wide">{item.name}</span>
              </button>
            ))}
          </nav>
          
          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-700 bg-slate-900/30">
            <div className="flex items-center space-x-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-white/20">
                <span className="text-white font-bold text-sm">AD</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium text-white">Admin User</p>
                <p className="text-xs text-gray-400">Online</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center space-x-4 px-4 py-3 text-gray-300 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-all duration-200 group"
            >
              <div className="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-red-300">
                <LogoutIcon />
              </div>
              <span className="font-medium text-sm tracking-wide">Logout</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 mr-4"
              >
                <MenuIcon />
              </button>
              <h1 className="text-xl font-bold text-gray-900 capitalize">{activeTab.replace('-', ' ')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                  <BellIcon />
                </button>
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"></span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Dashboard View */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Welcome Header */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, Administrator</h2>
                    <p className="text-gray-600">Here's what's happening with your grievance system today</p>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-600 text-sm font-medium">{stat.name}</p>
                          <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                          <p className="text-green-600 text-sm mt-1">{stat.change}</p>
                        </div>
                        <div className="text-3xl">{stat.icon}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                      {recentActivities.map((activity, index) => (
                        <div key={index} className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white text-sm">{activity.user.charAt(0)}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">{activity.user}</p>
                            <p className="text-gray-600 text-sm">{activity.action}</p>
                            <p className="text-gray-400 text-xs mt-1">{activity.time}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            activity.type === 'complaint' ? 'bg-amber-100 text-amber-800' :
                            activity.type === 'resolution' ? 'bg-green-100 text-green-800' :
                            activity.type === 'update' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {activity.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { name: 'New Grievance', icon: '➕', color: 'from-blue-500 to-cyan-500' },
                        { name: 'View Reports', icon: '📋', color: 'from-purple-500 to-violet-500' },
                        { name: 'User Management', icon: '👥', color: 'from-green-500 to-emerald-500' },
                        { name: 'System Settings', icon: '⚙️', color: 'from-amber-500 to-orange-500' }
                      ].map((action, index) => (
                        <button
                          key={index}
                          className="bg-gradient-to-r p-4 rounded-xl text-white hover:scale-105 transition-transform duration-200"
                        >
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${action.color} flex items-center justify-center mx-auto mb-2`}>
                            <span className="text-xl">{action.icon}</span>
                          </div>
                          <p className="text-sm font-medium text-center">{action.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Offices Management View */}
            {activeTab === 'offices' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Office Management</h2>
                    <p className="text-gray-600 mt-1">Manage offices available for complainants</p>
                  </div>
                  <button 
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all duration-200"
                    onClick={loadOffices}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>

                {/* Offices List */}
                <div className="overflow-x-auto rounded-xl border border-gray-200 mb-6">
                  <table className="min-w-full bg-white rounded-xl overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Office ID</th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Office Name</th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loadingOffices ? (
                        <tr>
                          <td colSpan="3" className="py-12 text-center text-gray-600">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              <span>Loading offices...</span>
                            </div>
                          </td>
                        </tr>
                      ) : offices.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="py-12 text-center text-gray-600">
                            No offices found
                          </td>
                        </tr>
                      ) : (
                        offices.map((office) => (
                          <tr key={office.id} className="hover:bg-gray-50 transition-colors duration-200">
                            <td className="py-4 px-6 font-mono text-sm text-gray-700">{office.id}</td>
                            <td className="py-4 px-6 font-medium text-gray-900">{office.name}</td>
                            <td className="py-4 px-6">
                              <div className="flex gap-3">
                                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                                  Edit
                                </button>
                                <button className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add New Office Form */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Office</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Office ID</label>
                      <input 
                        type="text" 
                        placeholder="e.g., academic_affairs"
                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Office Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Academic Affairs Office"
                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-xl shadow-lg font-medium transition-all duration-200 hover:shadow-xl">
                      Add Office
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Other tabs - placeholders */}
            {(activeTab === 'grievances' || activeTab === 'users' || activeTab === 'analytics' || activeTab === 'settings') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🚧</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
                <p className="text-gray-600">This section is under development</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
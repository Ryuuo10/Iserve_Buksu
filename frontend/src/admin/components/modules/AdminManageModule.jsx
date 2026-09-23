import { useState } from 'react';
import AdminUsersModule from '../../pages/AdminUsersModule';
import SystemSettingsModule from '../../pages/SystemSettingsModule';
import AuditLogsModule from '../../pages/AuditLogsModule';

const tabs = [
  {
    id: 'admin-users',
    label: 'Admin Users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'system-settings',
    label: 'System Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const AdminManageModule = () => {
  const [activeModule, setActiveModule] = useState('admin-users');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 overflow-hidden rounded-[28px] border border-blue-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 shadow-sm">
        <div className="flex flex-col gap-5 px-8 py-8 text-white lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
            <div>
              <h1 className="text-3xl font-bold">Admin Management</h1>
              <p className="mt-1 text-sm text-blue-100">Manage admin accounts, system controls, and audit visibility from one place.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-blue-50 backdrop-blur-sm">
            <p className="font-semibold">Superadmin Workspace</p>
            <p className="mt-1 text-blue-100/90">Access control, settings, and audit oversight.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-2 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveModule(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeModule === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-blue-50'
              }`}
            >
              <div className={`${activeModule === tab.id ? 'text-white' : 'text-gray-400'}`}>
                {tab.icon}
              </div>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[28px] shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8">
          {activeModule === 'admin-users' && <AdminUsersModule />}
          {activeModule === 'system-settings' && <SystemSettingsModule />}
          {activeModule === 'audit-logs' && <AuditLogsModule />}
        </div>
      </div>
    </div>
  );
};

export default AdminManageModule;

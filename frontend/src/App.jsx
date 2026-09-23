import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './auth/AuthPage';
import AdminDashboard from './admin/AdminDashboard';
import AdminManage from './admin/pages/AdminManage';
import { ComplainantDashboard } from './complainant';
import { OfficeDashboard } from './office';
import ProtectedRoute from './components/ProtectedRoute';
import PendingVerification from './components/PendingVerification';
import ProfileCompletionPage from './components/ProfileCompletionPage';
import { SocketProvider } from './context/SocketContext';
import './App.css';

console.log('App.jsx loaded - ProtectedRoute imported:', !!ProtectedRoute);

function App() {
  console.log('App component rendering');
  return (
    <SocketProvider>
      <div className="App">
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage authMode="legacy" />} />
        <Route path="/admin-login" element={<Navigate to="/" replace />} />
        <Route path="/complainant-login" element={<AuthPage authMode="complainant" />} />
        <Route path="/office-login" element={<AuthPage authMode="office" />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/profile-completion"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin', 'complainant', 'office_handler']}>
              <ProfileCompletionPage />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin-manage" 
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <AdminManage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/complainant" 
          element={
            <ProtectedRoute allowedRoles={['complainant']}>
              <ComplainantDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/office" 
          element={
            <ProtectedRoute allowedRoles={['office_handler']}>
              <OfficeDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/pending-verification" 
          element={<PendingVerification />} 
        />
      </Routes>
    </div>
    </SocketProvider>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import ComplainantDashboard from './pages/ComplainantDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/complainant" element={<ComplainantDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
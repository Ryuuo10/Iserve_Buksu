import { useState, useEffect } from 'react';
import axios from 'axios';

export const OfficesModule = () => {
  const [offices, setOffices] = useState([
    { name: "Academic Affairs Office", department: "Academic Services", cases: 42, status: "Active", colorScheme: "blue" },
    { name: "Student Services", department: "Student Affairs", cases: 28, status: "Active", colorScheme: "purple" },
    { name: "Finance Office", department: "Financial Services", cases: 15, status: "Active", colorScheme: "emerald" },
    { name: "Library", department: "Academic Resources", cases: 8, status: "Active", colorScheme: "amber" },
    { name: "IT Support", department: "Technology Services", cases: 12, status: "Active", colorScheme: "cyan" },
    { name: "Human Resources", department: "HR Department", cases: 6, status: "Active", colorScheme: "rose" }
  ]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Color schemes for different office types
  const colorSchemes = {
    blue: { 
      bg: 'bg-blue-50', 
      border: 'border-blue-200', 
      gradient: 'from-blue-500 to-blue-600',
      text: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-800',
      light: 'bg-blue-50',
      icon: 'text-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700'
    },
    purple: { 
      bg: 'bg-purple-50', 
      border: 'border-purple-200', 
      gradient: 'from-purple-500 to-purple-600',
      text: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-800',
      light: 'bg-purple-50',
      icon: 'text-purple-500',
      button: 'bg-purple-600 hover:bg-purple-700'
    },
    emerald: { 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200', 
      gradient: 'from-emerald-500 to-emerald-600',
      text: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-800',
      light: 'bg-emerald-50',
      icon: 'text-emerald-500',
      button: 'bg-emerald-600 hover:bg-emerald-700'
    },
    amber: { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200', 
      gradient: 'from-amber-500 to-amber-600',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-800',
      light: 'bg-amber-50',
      icon: 'text-amber-500',
      button: 'bg-amber-600 hover:bg-amber-700'
    },
    cyan: { 
      bg: 'bg-cyan-50', 
      border: 'border-cyan-200', 
      gradient: 'from-cyan-500 to-cyan-600',
      text: 'text-cyan-600',
      badge: 'bg-cyan-100 text-cyan-800',
      light: 'bg-cyan-50',
      icon: 'text-cyan-500',
      button: 'bg-cyan-600 hover:bg-cyan-700'
    },
    rose: { 
      bg: 'bg-rose-50', 
      border: 'border-rose-200', 
      gradient: 'from-rose-500 to-rose-600',
      text: 'text-rose-600',
      badge: 'bg-rose-100 text-rose-800',
      light: 'bg-rose-50',
      icon: 'text-rose-500',
      button: 'bg-rose-600 hover:bg-rose-700'
    }
  };

  const getOfficeIcon = (office, colorScheme) => {
    const iconColor = {
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      emerald: 'text-emerald-600',
      amber: 'text-amber-600',
      cyan: 'text-cyan-600',
      rose: 'text-rose-600'
    }[colorScheme];

    if (office.name.includes('Academic')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
        </svg>
      );
    }
    if (office.name.includes('Student')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18.5c-4.41 0-8-3.59-8-8V8l8-4 8 4v4.5c0 4.41-3.59 8-8 8z" />
        </svg>
      );
    }
    if (office.name.includes('Finance')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15h4v2h-4zm0-5h4v4h-4zm0-5h4v4h-4z" />
        </svg>
      );
    }
    if (office.name.includes('Library')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 6h16V4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v2H4v2h16v-2h-4v-2h4c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 12V6h16v12H4z" />
        </svg>
      );
    }
    if (office.name.includes('IT')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1z" />
        </svg>
      );
    }
    if (office.name.includes('Human')) {
      return (
        <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.5 1.6 2.97 3.51 2.97 5.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      );
    }
    return (
      <svg className={`w-16 h-16 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
    );
  };

  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await axios.get('/api/offices/categories');
        if (response.data.success && response.data.categories) {
          const officesData = response.data.categories.map(cat => ({
            name: cat.name,
            department: 'Office Department',
            cases: Math.floor(Math.random() * 50),
            status: cat.status === 'active' ? 'Active' : 'Inactive'
          }));
          setOffices(officesData);
        }
      } catch (error) {
        console.error('Failed to fetch offices:', error);
        // Dummy data remains as fallback
      }
    };

    fetchOffices();
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Office Management</h2>
          <p className="text-gray-600">View and manage all offices in the system</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offices.map((office, index) => {
          const colors = colorSchemes[office.colorScheme];
          return (
            <div 
              key={index} 
              className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer`}
              onClick={() => {
                setSelectedOffice(office);
                setIsModalOpen(true);
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-16 h-16`}>{getOfficeIcon(office, office.colorScheme)}</div>
                  <div>
                    <h3 className={`font-bold ${colors.text} text-lg`}>{office.name}</h3>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800`}>
                  {office.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-4 ml-11">{office.department}</p>
              <div className="flex justify-between items-center ml-11 pt-3 border-t border-gray-200">
                <div>
                  <p className={`text-2xl font-bold ${colors.text}`}>{office.cases}</p>
                  <p className="text-xs text-gray-600">active cases</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOffice(office);
                    setIsModalOpen(true);
                  }}
                  className={`${colors.button} text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm`}
                >
                  Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      {isModalOpen && selectedOffice && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in">
            {/* Modal Header with Gradient */}
            <div className={`bg-gradient-to-r ${colorSchemes[selectedOffice.colorScheme].gradient} px-8 py-8 relative overflow-hidden`}>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white bg-opacity-10 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -ml-16 -mb-16"></div>
              
              <div className="relative z-10 flex justify-between items-start">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20">{getOfficeIcon(selectedOffice, selectedOffice.colorScheme)}</div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">{selectedOffice.name}</h2>
                    <p className="text-blue-100 font-medium">{selectedOffice.department}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all hover:scale-110"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-8 py-8 space-y-8">
              {/* Stats Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`${colorSchemes[selectedOffice.colorScheme].light} rounded-2xl p-6 border-2 ${colorSchemes[selectedOffice.colorScheme].border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-700 font-medium">Status</p>
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className={`inline-block px-4 py-1 text-sm font-bold rounded-full bg-green-100 text-green-800`}>
                    {selectedOffice.status}
                  </span>
                </div>
                <div className={`${colorSchemes[selectedOffice.colorScheme].light} rounded-2xl p-6 border-2 ${colorSchemes[selectedOffice.colorScheme].border}`}>
                  <p className="text-gray-700 font-medium mb-2">Active Cases</p>
                  <p className={`text-4xl font-bold ${colorSchemes[selectedOffice.colorScheme].text}`}>{selectedOffice.cases}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-gray-100"></div>

              {/* Office Details */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Office Name</label>
                    <p className={`text-lg font-bold ${colorSchemes[selectedOffice.colorScheme].text}`}>{selectedOffice.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Department</label>
                    <p className={`text-lg font-bold ${colorSchemes[selectedOffice.colorScheme].text}`}>{selectedOffice.department}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t-2 border-gray-100">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-300"
                >
                  Close
                </button>
                <button className={`flex-1 py-3 px-4 ${colorSchemes[selectedOffice.colorScheme].button} text-white rounded-xl font-semibold transition-all duration-300 hover:shadow-lg`}>
                  Edit Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

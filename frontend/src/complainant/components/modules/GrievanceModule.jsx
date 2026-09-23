import { useState, useEffect } from "react";
import authService from "../../../services/authService";

const GrievanceModule = () => {
  const [activeMode, setActiveMode] = useState(null); // null, 'regular', or 'anonymous'
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm here to help you file your grievance. Would you like to file anonymously or include your personal information?",
      sender: 'bot',
      timestamp: new Date(),
      options: ["File Anonymously", "Include My Information"]
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState(null);
  
  // Fetch user data from localStorage or database
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Try to get user data from localStorage first
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserData({
            name: user.name || user.displayName || 'Unknown User',
            email: user.email || '',
            contact: user.contact || user.phone || ''
          });
          return;
        }
        
        // If not in localStorage, try to get from auth service
        const token = authService.getToken();
        if (token) {
          // Mock API call - replace with actual API endpoint
          // const response = await fetch('/api/user/profile', {
          //   headers: { 'Authorization': `Bearer ${token}` }
          // });
          // const userData = await response.json();
          
          // For now, simulate with mock data
          setUserData({
            name: 'John Doe',
            email: 'john.doe@example.com',
            contact: '(555) 123-4567'
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Set default values if fetch fails
        setUserData({
          name: 'Unknown User',
          email: '',
          contact: ''
        });
      }
    };
    
    fetchUserData();
  }, []);

  const regularSteps = [
    { question: "What category does your grievance fall under?", options: ["Academic Issues", "Administrative Concerns", "Facility Problems", "Financial Matters", "Other"] },
    { question: "Which office should handle this matter?", options: ["Academic Affairs Office", "Student Services", "Finance Office", "Library", "IT Support"] },
    { question: "Please provide a brief subject for your grievance:", type: 'text' },
    { question: "Please describe your grievance in detail:", type: 'textarea' },
    { question: "Would you like to attach any supporting documents?", options: ["Yes, upload documents", "No, submit without documents"] }
  ];
  
  const anonymousSteps = [
    { question: "What category does your grievance fall under?", options: ["Academic Issues", "Administrative Concerns", "Facility Problems", "Financial Matters", "Other"] },
    { question: "Which office should handle this matter?", options: ["Academic Affairs Office", "Student Services", "Finance Office", "Library", "IT Support"] },
    { question: "Please provide a brief subject for your grievance:", type: 'text' },
    { question: "Please describe your grievance in detail:", type: 'textarea' },
    { question: "Would you like to attach any supporting documents?", options: ["Yes, upload documents", "No, submit without documents"] }
  ];

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    const newUserMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    
    // Handle initial mode selection
    if (currentStep === 0 && !activeMode) {
      const selectedMode = inputValue.includes('Anonymous') ? 'anonymous' : 'regular';
      setActiveMode(selectedMode);
      
      setTimeout(() => {
        // For regular mode, show user info confirmation
        if (selectedMode === 'regular' && userData) {
          const userInfoMsg = {
            id: messages.length + 2,
            text: `I'll include your information in this grievance:\n\nName: ${userData.name}\nEmail: ${userData.email}\nContact: ${userData.contact}\n\nIs this correct?`,
            sender: 'bot',
            timestamp: new Date(),
            options: ["Yes, that's correct", "No, let me file anonymously instead"]
          };
          
          setMessages(prev => [...prev, userInfoMsg]);
          setCurrentStep(1);
        } else {
          // For anonymous mode or if no user data
          const firstStep = selectedMode === 'anonymous' ? anonymousSteps[0] : regularSteps[0];
          const botResponse = {
            id: messages.length + 2,
            text: firstStep.question,
            sender: 'bot',
            timestamp: new Date(),
            options: firstStep.options,
            type: firstStep.type
          };
          
          setMessages(prev => [...prev, botResponse]);
          setCurrentStep(1);
        }
      }, 1000);
      return;
    }
    
    // Handle user info confirmation for regular mode
    if (currentStep === 1 && activeMode === 'regular') {
      if (inputValue.includes('No') || inputValue.includes('anonymous')) {
        // User wants to switch to anonymous mode
        setActiveMode('anonymous');
        setTimeout(() => {
          const botResponse = {
            id: messages.length + 2,
            text: "Understood. Let's file this anonymously. " + anonymousSteps[0].question,
            sender: 'bot',
            timestamp: new Date(),
            options: anonymousSteps[0].options,
            type: anonymousSteps[0].type
          };
          
          setMessages(prev => [...prev, botResponse]);
          setCurrentStep(2);
        }, 1000);
        return;
      } else {
        // User confirmed their info, proceed with regular steps
        setTimeout(() => {
          const botResponse = {
            id: messages.length + 2,
            text: regularSteps[0].question,
            sender: 'bot',
            timestamp: new Date(),
            options: regularSteps[0].options,
            type: regularSteps[0].type
          };
          
          setMessages(prev => [...prev, botResponse]);
          setCurrentStep(2);
        }, 1000);
        return;
      }
    }
    
    // Continue with the selected flow
    const steps = activeMode === 'anonymous' ? anonymousSteps : regularSteps;
    const actualStepIndex = activeMode === 'regular' ? currentStep - 1 : currentStep;
    
    // Simulate bot response
    setTimeout(() => {
      if (actualStepIndex < steps.length) {
        const nextStep = steps[actualStepIndex];
        setCurrentStep(currentStep + 1);
        
        const botResponse = {
          id: messages.length + 2,
          text: nextStep.question,
          sender: 'bot',
          timestamp: new Date(),
          options: nextStep.options,
          type: nextStep.type
        };
        
        setMessages(prev => [...prev, botResponse]);
      } else {
        // Final step - submission
        const finalResponse = {
          id: messages.length + 2,
          text: activeMode === 'anonymous' 
            ? "Thank you for providing all the details. Your anonymous grievance has been submitted successfully! No personal information was collected."
            : `Thank you for providing all the details. Your grievance has been submitted successfully with your information:

Name: ${userData?.name || 'N/A'}
Email: ${userData?.email || 'N/A'}
Contact: ${userData?.contact || 'N/A'}

You'll receive a confirmation email shortly.`,
          sender: 'bot',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, finalResponse]);
      }
    }, 1000);
  };
  
  const handleOptionSelect = (option) => {
    setInputValue(option);
    handleSend();
  };
  
  const resetChat = () => {
    setMessages([
      {
        id: 1,
        text: "Hello! I'm here to help you file your grievance. Would you like to file anonymously or with your personal information?",
        sender: 'bot',
        timestamp: new Date(),
        options: ["File Anonymously", "Include My Information"]
      }
    ]);
    setInputValue('');
    setCurrentStep(0);
    setActiveMode(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h.01m7.5 0h.01M12 12h.01M14.25 16.5h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Grievance Filing Assistant</h2>
              <p className="text-blue-100 text-sm">Step-by-step guidance for your grievance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-white/20 text-white rounded-lg text-sm font-medium">
              {activeMode === 'anonymous' ? 'Anonymous Mode' : activeMode === 'regular' ? 'Regular Mode' : 'Select Mode'}
            </span>
            {activeMode && (
              <button
                onClick={resetChat}
                className="px-3 py-1 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-all duration-200"
              >
                Change
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'bot' && (
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              )}
              
              <div className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-2xl ${
                message.sender === 'user' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-none ml-3' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm mr-3'
              }`}>
                <p className="text-sm leading-relaxed">{message.text}</p>
                
                {message.options && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleOptionSelect(option)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-colors duration-200 ${
                          message.sender === 'user'
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              
              {message.sender === 'user' && (
                <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0 ml-3 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          {(
            activeMode === 'anonymous' 
              ? anonymousSteps[currentStep - 1]?.type 
              : activeMode === 'regular' 
                ? regularSteps[currentStep - 1]?.type 
                : null
          ) === 'textarea' ? (
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your response..."
                rows="2"
                className="w-full p-4 pr-12 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="absolute right-3 bottom-3 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(e)}
                placeholder="Type your response..."
                className="w-full p-4 pr-12 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default GrievanceModule;

import { useState } from "react";
import { useNavigate } from "react-router-dom";


function ComplainantDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chatbot");
  const [step, setStep] = useState("contact"); // contact | chatbot
  const [anonymous, setAnonymous] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <header className="bg-[#0A1A3F] text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white text-[#6495ED] rounded-full flex items-center justify-center font-bold">
              LOGO
            </div>
            <div>
              <h1 className="text-xl font-bold">
                I-Serve Grievance Chatbot
              </h1>
          <p className="text-sm opacity-90">
            Grievance Management System
          </p>
            </div>
          </div>

        </div>

        <div className="flex items-center gap-6">
          <span className="text-xl">🔔</span>

          <div className="text-right">
            <h2 className="font-semibold">User Name</h2>
            <p className="text-sm opacity-90">Complainant</p>
          </div>

            <button onClick={() => navigate("/")} className="text-xl cursor-pointer">🚪</button>
        </div>
      </header>

      {/* WELCOME BANNER */}
      <section className="bg-[#0A1A3F] text-white px-6 py-10 m-6 rounded-2xl">
        <h2 className="text-2xl font-bold">
          Welcome to the Grievance Portal
        </h2>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Submit your complaints through our AI-powered chatbot or track your existing grievances.
        </p>
      </section>

      {/* BODY */}
      <main className="p-6 space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {["Total Grievances", "Pending", "In Progress", "Resolved"].map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-semibold">{t}</h3>
              <div className="flex justify-between items-end mt-4">
                <span className="text-2xl font-bold">0</span>
                <span className="text-xl">📄</span>
              </div>
            </div>
          ))}
        </div>

        {/* SWITCH BUTTONS */}
        <div className="flex bg-white rounded-full p-1 w-fit shadow">
          {["chatbot", "my"].map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-6 py-2 rounded-full font-medium transition ${
                activeTab === key
                  ? "bg-[#0A1A3F] text-white"
                  : "text-gray-600"
              }`}
            >
              {key === "chatbot" ? "AI Chatbot" : "My Grievances"}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {activeTab === "chatbot" && (
          <div className="bg-white rounded-xl p-6 shadow space-y-6">

            {/* INTRO */}
            <div>
              <h2 className="text-xl font-bold">
                Submit a Grievance
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                You'll be asked to provide your name and contact information first, then describe your issue.
                Our AI will help categorize and process your complaint. You can choose to submit anonymously.
              </p>
            </div>

            {step === "contact" ? (
              <>

                {/* ANONYMOUS CHECK */}
                <div className="border rounded-lg p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={() => setAnonymous(!anonymous)}
                      className="mt-1"
                    />
                    <div>
                      <h4 className="font-medium">
                        Submit Anonymously
                      </h4>
                      <p className="text-sm text-gray-500">
                        Check this box to submit without providing personal information.
                      </p>
                    </div>
                  </label>
                </div>

                {/* PRIVACY NOTICE */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-sm">
                  <strong>Privacy Notice:</strong> If you choose not to submit anonymously,
                  your name and contact information will be visible to administrators and office handlers.
                </div>

                {/* CONTACT FORM */}
                {!anonymous && (
                  <div className="space-y-3">
                    <input
                      placeholder="Full Name"
                      className="w-full border p-3 rounded-lg"
                    />
                    <input
                      placeholder="Contact Number"
                      className="w-full border p-3 rounded-lg"
                    />
                  </div>
                )}

                <button
                  onClick={() => setStep("chatbot")}
                  className="bg-[#0A1A3F] text-white px-6 py-3 rounded-lg"
                >
                  Continue with Contact Info
                </button>
              </>
            ) : (
              <>
                {/* CONFIRMATION HEADER */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-sm">
                        Confidential Submission
                      </span>
                      <span className="text-sm text-gray-500">
                        Active
                      </span>
                    </div>
                    <p className="text-sm mt-1">
                      Submitted as: <strong>User Name</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => setStep("contact")}
                    className="text-red-600 border border-red-500 px-3 py-1 rounded"
                  >
                    Edit Info
                  </button>
                </div>

          {/* CHATBOT */}
          <div className="bg-gray-50 border rounded-lg p-4 flex flex-col h-[500px]">

            {/* CHAT MESSAGES */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">

              {/* BOT MESSAGE */}
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6495ED] text-white flex items-center justify-center text-sm">
                  AI
                </div>
                <div className="bg-white border rounded-xl p-3 text-sm max-w-[80%] whitespace-pre-line">
                  ✅ <strong>Confidential Submission Selected</strong>

                  🔐 <strong>Privacy & Data Usage:</strong>
                  • Your personal information will be collected securely  
                  • Only authorized administrators and office handlers can view your contact details  
                  • Your data will be used solely for processing and follow-up  
                  • Protected by university privacy policies  

                  📝 <strong>Your Consent:</strong> By providing your information, you consent to its use.

                  Now, please describe your issue in detail, and I’ll help categorize and process it.
                </div>
              </div>

              {/* USER MESSAGE (placeholder – will be dynamic later) */}
              <div className="flex justify-end">
                <div className="bg-[#6495ED] text-white rounded-xl p-3 text-sm max-w-[75%]">
                  I want to report an issue regarding delayed document processing.
                </div>
              </div>

            </div>

            {/* SUGGESTED KEYWORDS */}
            <div className="flex flex-wrap gap-2 my-3">
              {[
                "Delayed Processing",
                "Unresponsive Office",
                "Harassment",
                "Facilities Issue",
                "Academic Concern",
              ].map((tag, i) => (
                <button
                  key={i}
                  className="text-xs px-3 py-1 bg-white border rounded-full hover:bg-[#6495ED] hover:text-white transition"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* INPUT BAR */}
            <div className="border-t pt-3 flex items-center gap-2">
              <label className="cursor-pointer text-xl">
                📎
                <input type="file" className="hidden" />
              </label>

              <input
                type="text"
                placeholder="Type your grievance here..."
                className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6495ED]"
              />

              <button className="bg-[#6495ED] text-white px-4 py-2 rounded-full text-sm">
                Send
              </button>
            </div>

          </div>

              </>
            )}
          </div>
        )}

        {activeTab === "my" && (
          <div className="bg-white rounded-xl p-6 shadow">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  My Grievances
                </h2>
                <p className="text-sm text-gray-500">
                  Track the status of your submitted complaints
                </p>
              </div>

              <button className="bg-[#6495ED] text-white px-4 py-2 rounded-lg">
                + New Grievance
              </button>
            </div>

            {/* DATA PLACEHOLDER */}
            <div className="space-y-3">
              <div className="h-16 bg-gray-100 rounded-lg" />
              <div className="h-16 bg-gray-100 rounded-lg" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default ComplainantDashboard;

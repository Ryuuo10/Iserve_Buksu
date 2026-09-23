import { useNavigate } from "react-router-dom";
import SignupForm from "./components/SignupForm";

const AUTH_PAGE_CONFIG = {
  legacy: {
    title: "Create Account",
    eyebrow: "Unified Access",
    description:
      "Create an account, then the system will take you to the correct dashboard automatically.",
    accent: "from-blue-600 via-cyan-500 to-sky-500",
    heroTone: "from-slate-950 via-slate-900 to-blue-950",
    showSignup: true,
    forcedLoginRole: "",
    allowRoleSelection: false,
    signupAllowedRoles: ["complainant", "office_handler"],
    signupDefaultRole: "",
  },

  complainant: {
    title: "Complainant Access",
    eyebrow: "Student Portal",
    description:
      "Create an account to file a grievance, review updates, and follow your case from submission to resolution.",
    accent: "from-emerald-600 via-green-500 to-lime-500",
    heroTone: "from-slate-950 via-emerald-950 to-slate-900",
    showSignup: true,
    forcedLoginRole: "complainant",
    allowRoleSelection: false,
    signupAllowedRoles: ["complainant"],
    signupDefaultRole: "complainant",
  },

  office: {
    title: "Office Handler Access",
    eyebrow: "Office Workflow",
    description:
      "Create an account to review routed grievances, manage RCA, and close cases with documented actions.",
    accent: "from-fuchsia-600 via-violet-500 to-indigo-500",
    heroTone: "from-slate-950 via-violet-950 to-slate-900",
    showSignup: true,
    forcedLoginRole: "office",
    allowRoleSelection: false,
    signupAllowedRoles: ["office_handler"],
    signupDefaultRole: "office_handler",
  },

  admin: {
    title: "Administrator Access",
    eyebrow: "Control Panel",
    description:
      "Administrator accounts are managed separately from the public signup process.",
    accent: "from-blue-600 via-indigo-500 to-cyan-500",
    heroTone: "from-slate-950 via-blue-950 to-slate-900",
    showSignup: false,
    forcedLoginRole: "admin",
    allowRoleSelection: false,
    signupAllowedRoles: [],
    signupDefaultRole: "",
  },
};

const AUTH_CAPABILITIES = {
  legacy: [
    "Role-based access for admins, office handlers, and complainants",
    "Protected grievance workflows with live status updates",
    "Unified case review, routing, and RCA documentation",
  ],

  complainant: [
    "Submit complaints with guided intake",
    "Track grievance status and resolution updates",
    "Review completed resolutions and submit satisfaction feedback",
  ],

  office: [
    "Receive routed grievances for office review",
    "Document RCA and resolution actions in one workflow",
    "Manage office queue by urgency and active case status",
  ],

  admin: [
    "Review and route grievances with AI-assisted context",
    "Manage users, offices, notifications, and analytics",
    "Apply superadmin controls and RBAC where authorized",
  ],
};

const AUTH_STATS = {
  legacy: [
    ["Access", "Multi-role portal"],
    ["Workflow", "Unified grievance handling"],
  ],

  complainant: [
    ["Purpose", "Complainant tracking"],
    ["Flow", "Submit to resolution"],
  ],

  office: [
    ["Purpose", "Office case review"],
    ["Flow", "Queue to RCA"],
  ],

  admin: [
    ["Purpose", "System oversight"],
    ["Flow", "Review to routing"],
  ],
};

function AuthPage({ authMode = "legacy" }) {
  const navigate = useNavigate();

  const config =
    AUTH_PAGE_CONFIG[authMode] || AUTH_PAGE_CONFIG.legacy;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT SIDE */}
        <div
          className={`relative hidden overflow-hidden lg:flex bg-gradient-to-br ${config.heroTone}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_24%)]" />

          <div className="absolute left-12 top-14 h-32 w-32 rounded-full bg-white/8 blur-2xl" />

          <div className="absolute bottom-16 right-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-between p-10 xl:p-14">

            <div className="max-w-xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80 backdrop-blur">
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${config.accent}`}
                />

                {config.eyebrow}
              </div>

              <h1 className="mt-8 max-w-lg text-5xl font-bold leading-[1.05] text-white">
                {config.title}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
                {config.description}
              </p>
            </div>

            <div className="mt-10 grid max-w-2xl gap-5">

              <div className="rounded-[28px] border border-white/12 bg-white/8 p-8 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.9)] backdrop-blur-md">

                <div className="flex items-start justify-between gap-8">

                  <div className="max-w-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                      Grievance Platform
                    </p>

                    <h2 className="mt-4 text-2xl font-semibold text-white">
                      Focused access, clearer entry points
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      The signup page is centered around a tighter
                      authentication panel so users see the form as
                      the primary task.
                    </p>
                  </div>

                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${config.accent} shadow-lg shadow-slate-950/30`}
                  >
                    <svg
                      className="h-8 w-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>

                </div>

                <div className="mt-8 grid gap-3">

                  {AUTH_CAPABILITIES[authMode]?.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3"
                    >
                      <div
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r ${config.accent}`}
                      />

                      <p className="text-sm leading-6 text-slate-200">
                        {item}
                      </p>
                    </div>
                  ))}

                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">

                {AUTH_STATS[authMode]?.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/6 px-5 py-4 backdrop-blur"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {label}
                    </p>

                    <p className="mt-3 text-lg font-semibold text-white">
                      {value}
                    </p>
                  </div>
                ))}

              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative flex min-h-screen items-start justify-center overflow-hidden px-3 py-4 sm:items-center sm:px-6 sm:py-8 lg:px-10">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_22%)]" />

          <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100" />

          <div className="relative z-10 w-full max-w-[720px]">

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_32px_90px_-38px_rgba(15,23,42,0.32)] backdrop-blur sm:rounded-[32px]">

              {/* HEADER */}
              <div className="border-b border-slate-200 px-4 py-5 sm:px-8 sm:py-6">

                <div className="relative">

                  <div className="mx-auto max-w-xl px-12 text-center sm:px-0">

                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {config.eyebrow}
                    </p>

                    <h1 className="mt-3 text-2xl font-bold text-slate-950">
                      {config.title}
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {config.description}
                    </p>

                  </div>

                  {/* BACK BUTTON */}
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    aria-label="Back to welcome page"
                    title="Back to welcome page"
                    className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 sm:h-12 sm:w-12 sm:rounded-2xl"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                </div>
              </div>

              {/* SIGNUP FORM ONLY */}
              <div className="px-4 py-5 sm:px-8 sm:py-6">

                <div className="mx-auto max-w-[560px] overflow-y-visible pr-0 sm:max-h-[calc(100vh-250px)] sm:overflow-y-auto sm:pr-1">

                  <SignupForm
                    allowedRoles={config.signupAllowedRoles}
                    defaultRole={config.signupDefaultRole}
                  />

                </div>

              </div>

              {/* FOOTER */}
              <div className="border-t border-slate-200 px-4 py-4 text-center sm:px-8">

                <p className="text-xs text-slate-500">
                  © {new Date().getFullYear()} I-Serve Grievance Chatbot
                </p>

              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;

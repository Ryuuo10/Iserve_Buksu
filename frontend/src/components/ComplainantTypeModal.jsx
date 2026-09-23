import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

const TYPE_OPTIONS = [
  {
    value: 'student',
    label: 'Student',
    desc: 'I am currently enrolled and filing as a student.',
    badge: 'Academic',
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'shadow-emerald-500/20',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l8-4-8-4-8 4 8 4zm0 0l6.16-3.08A6 6 0 0118 16.92V17a6 6 0 01-12 0v-.08a6 6 0 01-.16-2.92L12 14z" />
      </svg>
    ),
  },
  {
    value: 'parent',
    label: 'Parent',
    desc: 'I am submitting on behalf of my child or as a guardian.',
    badge: 'Family',
    accent: 'from-amber-500 via-orange-500 to-rose-500',
    glow: 'shadow-orange-500/20',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5V9a2 2 0 00-2-2h-3m0 13v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6m10 0H7m10 0H7M7 20H2V9a2 2 0 012-2h3m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    value: 'staff',
    label: 'Staff',
    desc: 'I am part of the university staff or faculty workforce.',
    badge: 'Professional',
    accent: 'from-indigo-500 via-violet-500 to-fuchsia-500',
    glow: 'shadow-violet-500/20',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21H3m15-10V7a2 2 0 00-2-2h-3V3H11v2H8a2 2 0 00-2 2v4m12 0v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6m12 0H6" />
      </svg>
    ),
  },
];

function ComplainantTypeModal({ isOpen, onClose, onSelect, isLoading = false, userData = null }) {
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
    }
  }, [isOpen]);

  const handleSelect = async () => {
    if (!selectedType) {
      Swal.fire({
        icon: 'warning',
        title: 'Please select a type',
        text: 'You must select Student, Parent, or Staff.',
      });
      return;
    }

    try {
      await onSelect(selectedType);
    } catch (error) {
      console.error('Complainant type selection failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(3,16,20,0.74)] backdrop-blur-lg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_22%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.22),rgba(2,6,23,0.08))]" />
      <div className="min-h-full px-4 py-6 sm:px-6 md:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
          <div className="relative w-full overflow-hidden rounded-[32px] border border-emerald-100/18 bg-[rgba(6,27,30,0.94)] shadow-[0_45px_140px_-30px_rgba(3,10,18,0.88)] backdrop-blur-2xl animate-modalPop">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.1),transparent_24%)]" />
            <div className="absolute -left-12 top-10 h-32 w-32 rounded-full bg-emerald-400/16 blur-3xl" />
            <div className="absolute -right-10 bottom-12 h-36 w-36 rounded-full bg-cyan-400/16 blur-3xl" />

            <div className="relative z-10">
              <div className="border-b border-white/10 bg-gradient-to-r from-slate-950/85 via-emerald-950/80 to-slate-900/80 px-6 py-7 text-white sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-100/60">
                      Profile Classification
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight">Choose Your Type</h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300/90">
                      {userData?.name
                        ? `${userData.name}, select the profile category that best represents how you are filing in the grievance portal.`
                        : 'Select the profile category that best represents how you are filing in the grievance portal.'}
                    </p>
                  </div>

                    <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/70">Access Role</p>
                    <p className="mt-2 text-sm font-semibold text-white">Complainant</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8 sm:py-8">
                <div className="mb-6 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_45px_-30px_rgba(3,10,18,0.6)] backdrop-blur xl:grid-cols-3">
                  <div className="rounded-2xl bg-white/[0.06] px-4 py-4 text-white ring-1 ring-white/10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Email</p>
                    <p className="mt-2 truncate text-sm font-medium text-slate-100">{userData?.email || 'Pending Google account'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Purpose</p>
                    <p className="mt-2 text-sm font-medium text-slate-100">Profile completion</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Use</p>
                    <p className="mt-2 text-sm font-medium text-slate-100">Student, parent, or staff classification</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {TYPE_OPTIONS.map((option) => {
                    const isSelected = selectedType === option.value;

                    return (
                      <label
                        key={option.value}
                        className={`group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-[24px] border px-4 py-4 transition-all duration-300 sm:px-5 ${
                          isSelected
                            ? 'border-emerald-300/35 bg-gradient-to-r from-emerald-950/80 via-teal-950/75 to-cyan-950/70 text-white shadow-[0_22px_60px_-28px_rgba(16,185,129,0.28)]'
                            : 'border-white/10 bg-white/[0.05] text-slate-100 shadow-[0_14px_40px_-30px_rgba(3,10,18,0.55)] hover:-translate-y-0.5 hover:border-emerald-200/20 hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${option.accent} ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'} transition-opacity`} />

                        <input
                          type="radio"
                          name="complainantType"
                          value={option.value}
                          checked={isSelected}
                          onChange={(e) => setSelectedType(e.target.value)}
                          className="sr-only"
                        />

                        <div className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${option.accent} text-white shadow-lg ${option.glow}`}>
                          {option.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-lg font-semibold tracking-tight">{option.label}</p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                              isSelected ? 'bg-white/12 text-white/75' : 'bg-white/10 text-slate-300'
                            }`}>
                              {option.badge}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm leading-6 ${isSelected ? 'text-slate-300' : 'text-slate-300/88'}`}>
                            {option.desc}
                          </p>
                        </div>

                        <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200'
                            : 'border-white/30 bg-transparent text-transparent group-hover:border-emerald-200/40'
                        }`}>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/[0.04] px-6 py-5 backdrop-blur sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-sm leading-6 text-slate-300/82">
                    This improves complainant classification in the portal and will be shown in relevant administrative views.
                  </p>

                  <div className="flex flex-col gap-3 sm:min-w-[260px] sm:items-end">
                    <button
                      onClick={handleSelect}
                      disabled={isLoading || !selectedType}
                      className={`w-full rounded-2xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 sm:w-auto sm:min-w-[220px] ${
                        selectedType && !isLoading
                          ? 'bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 text-slate-950 shadow-[0_18px_45px_-18px_rgba(34,197,94,0.5)] hover:-translate-y-0.5'
                          : 'cursor-not-allowed bg-slate-700 text-slate-300 shadow-none'
                      }`}
                    >
                      {isLoading ? 'Saving...' : 'Continue'}
                    </button>

                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-sm font-medium text-slate-300/70 transition-colors hover:text-white disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComplainantTypeModal;

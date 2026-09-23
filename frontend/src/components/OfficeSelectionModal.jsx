import { useState } from 'react';
import Swal from 'sweetalert2';

function OfficeSelectionModal({ offices, userData, onSelect, isLoading, mode = 'dashboard' }) {
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isApprovalMode = mode === 'approval';

  const filteredOffices = offices.filter((office) =>
    String(office?.name || '')
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );

  const handleOfficeSelect = (office) => {
    setSelectedOffice(office);
  };

  const handleSubmit = async () => {
    if (!selectedOffice) {
      Swal.fire({
        icon: 'warning',
        title: 'Please Select',
        text: isApprovalMode
          ? 'Please select your office category before submitting your registration.'
          : 'Please select an office to continue.',
        confirmButtonColor: '#3b82f6',
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSelect(selectedOffice.id);
    } catch (error) {
      console.error('Error selecting office:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const officeColors = {
    registrar: { bg: 'from-blue-500 to-cyan-500', accent: 'border-blue-200' },
    finance: { bg: 'from-emerald-500 to-green-500', accent: 'border-emerald-200' },
    admissions: { bg: 'from-indigo-500 to-blue-500', accent: 'border-indigo-200' },
    student_affairs: { bg: 'from-fuchsia-500 to-pink-500', accent: 'border-fuchsia-200' },
    academic: { bg: 'from-orange-500 to-amber-500', accent: 'border-orange-200' },
    hr: { bg: 'from-rose-500 to-red-500', accent: 'border-rose-200' },
    it: { bg: 'from-sky-500 to-cyan-500', accent: 'border-sky-200' },
    facilities: { bg: 'from-yellow-500 to-amber-500', accent: 'border-yellow-200' },
    health: { bg: 'from-emerald-500 to-teal-500', accent: 'border-teal-200' },
    security: { bg: 'from-slate-500 to-slate-700', accent: 'border-slate-200' },
    fallback: { bg: 'from-blue-500 to-indigo-500', accent: 'border-blue-200' },
  };

  const getOfficeKey = (office) => office?.id?.replace(/\s+/g, '_').toLowerCase() || 'fallback';

  const getOfficeColor = (office) => {
    const key = getOfficeKey(office);
    return officeColors[key] || officeColors.fallback;
  };

  const getOfficeLevel = (office) =>
    String(office?.department || '').trim() ? 'Department-level' : 'College-level';

  const getOfficeTitle = (office) => {
    const college = String(office?.college || office?.name || '').trim();
    const department = String(office?.department || '').trim();
    return department ? `${college} - ${department}` : college;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full p-4 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-5xl rounded-[2rem] border border-white/25 bg-white/90 shadow-[0_35px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 px-6 py-8 md:px-10 md:py-10 text-white">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-blue-100/80 mb-3">
                Office Access Setup
              </p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                {isApprovalMode ? 'Choose the Right Office Category' : 'Choose the Office Linked to Your Account'}
              </h1>
              <p className="mt-4 text-sm md:text-base text-blue-50/90 leading-7">
                {isApprovalMode
                  ? 'Use search to find your department quickly and choose the office category that matches your request.'
                  : 'Pick the office that should receive and manage grievances tied to your account.'}
              </p>
            </div>
          </div>

          <div className="px-6 py-6 md:px-10 md:py-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <section className="min-w-0">
                <div className="flex flex-col gap-4 mb-5">
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Account
                    </p>
                    <p className="mt-2 text-lg font-bold text-slate-900">
                      {userData?.user?.name || 'Office Handler'}
                    </p>
                    <p className="text-sm text-slate-700 break-all">
                      {userData?.user?.email}
                    </p>
                  </div>

                  <label className="relative block">
                    <span className="sr-only">Search office categories</span>
                    <svg
                      className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-4.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search office category"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-14 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Available categories</p>
                      <p className="text-xs text-slate-500">
                        {filteredOffices.length} {filteredOffices.length === 1 ? 'result' : 'results'}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {offices.length} total
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto px-3 py-3">
                    {filteredOffices.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                        <p className="text-base font-semibold text-slate-800">No matching office category</p>
                        <p className="mt-2 text-sm text-slate-500">
                          Try a different keyword or clear the search field.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredOffices.map((office, index) => {
                          const colors = getOfficeColor(office);
                          const isSelected = selectedOffice?.id === office.id;

                          return (
                            <button
                              key={office.id}
                              type="button"
                              onClick={() => handleOfficeSelect(office)}
                              className={`w-full rounded-2xl border text-left transition-all duration-200 ${
                                isSelected
                                  ? `bg-slate-900 text-white shadow-lg ${colors.accent}`
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start gap-4 px-4 py-4 md:px-5">
                                <div className={`shrink-0 pt-1 text-sm font-black ${isSelected ? 'text-cyan-200' : 'text-slate-400'}`}>
                                  {String(index + 1).padStart(2, '0')}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className={`text-base font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                      {getOfficeTitle(office)}
                                    </p>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      isSelected ? 'bg-white/15 text-cyan-100' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {getOfficeLevel(office)}
                                    </span>
                                  </div>
                                  <p className={`mt-1 text-sm ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {isApprovalMode
                                      ? 'Submit this category for approval to route future grievance handling access.'
                                      : 'Use this office to connect your dashboard and assigned grievance flow.'}
                                  </p>
                                </div>

                                <div className="shrink-0 pt-1">
                                  {isSelected ? (
                                    <div className="rounded-full bg-emerald-400/20 p-2 text-emerald-300">
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="rounded-full border border-slate-300 p-2 text-slate-300">
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="5" strokeWidth={2} />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <aside className="flex flex-col gap-4">
                <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 p-6 text-white shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/85">
                    Selection Summary
                  </p>

                  {selectedOffice ? (
                    <div className="mt-4">
                      <div className="inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                        Ready
                      </div>
                      <h2 className="mt-4 text-2xl font-black leading-tight">
                        {getOfficeTitle(selectedOffice)}
                      </h2>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100">
                        {getOfficeLevel(selectedOffice)}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-blue-50/85">
                        {isApprovalMode
                          ? 'This office category will be sent for administrator review before your office handler access is activated.'
                          : 'This office will be linked to your account so your workspace reflects the correct grievance queue.'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                        Waiting
                      </div>
                      <h2 className="mt-4 text-2xl font-black leading-tight">
                        No category selected yet
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-blue-50/85">
                        Pick a category from the list to unlock submission. Search is helpful once your office list grows.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedOffice || submitting}
                  className={`w-full rounded-2xl px-6 py-4 text-base font-bold text-white transition-all duration-300 ${
                    selectedOffice
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600'
                      : 'cursor-not-allowed bg-slate-300'
                  }`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isApprovalMode ? 'Submitting...' : 'Continuing...'}
                    </span>
                  ) : (
                    isApprovalMode ? 'Submit for Approval' : 'Continue to Dashboard'
                  )}
                </button>

                <p className="text-center text-sm leading-6 text-slate-500">
                  {isApprovalMode
                    ? 'Your selected office category will be reviewed by the administrator before dashboard access is granted.'
                    : 'Your selected office will help route grievances to the correct department.'}
                </p>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OfficeSelectionModal;

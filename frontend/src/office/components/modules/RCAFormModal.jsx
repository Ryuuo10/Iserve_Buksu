import RootCauseAnalysisForm from './RootCauseAnalysisForm';
import RootCauseAnalysisView from '../../../admin/components/modules/RootCauseAnalysisView';
import { hasCompleteRcaDetails } from '../../../utils/rcaReport';

const RCAFormModal = ({ isOpen, grievance, onClose, onRCASaved, onResolved, onLockConflict }) => {
  if (!isOpen || !grievance) return null;

  const showReadOnlyView =
    grievance.rootCauseAnalysis?.rcaStatus === 'resolved' && hasCompleteRcaDetails(grievance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/35 px-4 py-6 backdrop-blur-md">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(34,211,238,0.14),_transparent_34%)]"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/55 bg-white shadow-[0_28px_80px_-36px_rgba(15,23,42,0.75)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Case Resolution Analysis</h2>
                <p className="mt-1 text-sm text-slate-500">
                  ID: {grievance.referenceNumber || grievance.trackingId}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            title="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white/55">
          {showReadOnlyView ? (
            <div className="p-6">
              <RootCauseAnalysisView grievance={grievance} />
            </div>
          ) : (
            <RootCauseAnalysisForm
              grievance={grievance}
              onClose={onClose}
              onRCASaved={onRCASaved}
              onResolved={onResolved}
              onLockConflict={onLockConflict}
            />
          )}
        </div>

        {/* Footer */}
        {showReadOnlyView && (
          <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-200/70 bg-white/70 px-8 py-5 backdrop-blur-md">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white/75 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-white"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RCAFormModal;

const GrievanceDeleteModal = ({
  isOpen,
  grievance,
  reason,
  saving = false,
  onChangeReason,
  onDelete,
  onClose,
}) => {
  if (!isOpen || !grievance) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="bg-gradient-to-r from-rose-600 to-red-600 px-8 py-6 flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-2xl font-bold">Archive Grievance</h2>
            <p className="text-white/80 text-sm">
              Tracking ID: {grievance.referenceNumber || grievance.trackingId}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-900">
            This will move the grievance to the Archive file. A reason is required before continuing.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Subject</p>
              <p className="font-medium text-gray-900">{grievance.subject || '--'}</p>
            </div>
            <div>
              <p className="text-gray-500">Complainant</p>
              <p className="font-medium text-gray-900">
                {grievance.isAnonymous ? 'Anonymous' : grievance.complainantName || grievance.complainantId?.name || '--'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for archiving</label>
            <textarea
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              className="w-full min-h-[140px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="Explain why this grievance is being archived..."
            />
          </div>
        </div>

        <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={saving}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Archiving...' : 'Archive Grievance'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrievanceDeleteModal;

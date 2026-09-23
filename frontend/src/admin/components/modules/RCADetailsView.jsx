import {
  getFishboneEntries,
  getRcaCategoryLabel,
  hasFishboneContent,
  RCA_FISHBONE_SECTIONS,
} from '../../../utils/rcaReport';

const RCADetailsView = ({ grievance }) => {
  if (!grievance?.rootCauseAnalysis) {
    return null;
  }

  const rca = grievance.rootCauseAnalysis;
  const completedDate = rca.completedAt ? new Date(rca.completedAt).toLocaleString() : 'N/A';
  const completedBy = rca.completedBy?.name || 'Unknown';

  const statusBadgeColor = {
    resolved: 'bg-emerald-100 text-emerald-800',
    in_progress: 'bg-blue-100 text-blue-800',
    escalated: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="border-t pt-6 mt-6">
      {/* RCA Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 mb-6 border border-blue-200">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Root Cause Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">Completed by {completedBy} on {completedDate}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeColor[rca.rcaStatus] || 'bg-gray-100 text-gray-800'}`}>
            {rca.rcaStatus ? rca.rcaStatus.replace('_', ' ').toUpperCase() : 'N/A'}
          </span>
        </div>
      </div>

      {/* RCA Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Problem Summary */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Problem Summary</label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{rca.problemSummary || '--'}</p>
          </div>
        </div>

        {/* Root Cause Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Root Cause Category</label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-gray-800 text-sm">{getRcaCategoryLabel(rca.rootCauseCategory) || '--'}</p>
          </div>
        </div>

        {/* Root Cause Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Root Cause Description</label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{rca.rootCauseDescription || '--'}</p>
          </div>
        </div>

        {/* Action Taken */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Action Taken</label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{rca.actionTaken || '--'}</p>
          </div>
        </div>

        {/* Preventive Action */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Preventive Action</label>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-gray-800 text-sm whitespace-pre-wrap">{rca.preventiveAction || '--'}</p>
          </div>
        </div>

        {hasFishboneContent(rca) && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Fishbone Analysis</label>
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {RCA_FISHBONE_SECTIONS.map(({ key, title }) => {
                const entries = getFishboneEntries(rca, key);

                if (entries.length === 0) {
                  return null;
                }

                return (
                  <div key={key}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
                    <ul className="mt-2 space-y-2">
                      {entries.map((entry, index) => (
                        <li key={`${key}-${index}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-[0_10px_20px_-22px_rgba(15,23,42,0.35)]">
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Responsible Office */}
        {grievance.office && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Responsible Office</label>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-gray-800 text-sm">
                {grievance.office}{grievance.department ? `, ${grievance.department}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Resolution Date */}
        {completedDate !== 'N/A' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Date</label>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-gray-800 text-sm">{completedDate}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RCADetailsView;

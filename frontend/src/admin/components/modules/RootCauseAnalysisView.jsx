import {
  downloadRcaPdf,
  formatOfficeLabel,
  getFishboneEntries,
  getLegacyResolutionEvidenceNotes,
  getRcaCategoryLabel,
  getResolutionEvidence,
  hasCompleteRcaDetails,
  hasFishboneContent,
  hasRcaContent,
  hasResolutionEvidence,
  RCA_FISHBONE_SECTIONS,
} from '../../../utils/rcaReport';
import AttachmentPreviewCard from '../../../components/AttachmentPreviewCard';

const InfoCard = ({ label, value, subtle, compact = false }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <div className={`mt-3 text-sm leading-7 ${subtle ? 'text-slate-500' : 'text-slate-900'}`}>{value}</div>
  </div>
);

const SectionPanel = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const FishboneList = ({ entries }) => (
  <ul className="space-y-2">
    {entries.map((entry, index) => (
      <li key={`${entry}-${index}`} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.35)]">
        {entry}
      </li>
    ))}
  </ul>
);

export const FishboneAnalysisPanel = ({ rca }) => {
  if (!hasFishboneContent(rca)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
        No contributing causes recorded.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {RCA_FISHBONE_SECTIONS.map(({ key, title, subtitle }) => {
        const entries = getFishboneEntries(rca, key);

        if (entries.length === 0) {
          return null;
        }

        return (
          <div key={key} className="space-y-3 rounded-2xl border border-slate-300 bg-slate-50/70 p-4">
            <div>
              <h5 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">{title}</h5>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <FishboneList entries={entries} />
          </div>
        );
      })}
    </div>
  );
};

const EvidenceAttachmentList = ({ attachments }) => (
  <div className="space-y-3">
    {attachments.map((attachment, index) => (
      <AttachmentPreviewCard
        key={`${attachment.url || attachment.fileName || index}-${index}`}
        attachment={attachment}
        index={index}
        fallbackLabel="Resolution Evidence"
        openLabel="Open Evidence"
      />
    ))}
  </div>
);

const RootCauseAnalysisView = ({ grievance, showFishbone = true }) => {
  if (!hasRcaContent(grievance)) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600">Root Cause Analysis not yet completed</p>
      </div>
    );
  }

  const rca = grievance.rootCauseAnalysis;
  const statusBadgeColor = {
    in_progress: 'bg-amber-100 text-amber-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    escalated: 'bg-purple-100 text-purple-800',
  };
  const completedBy = rca.completedBy?.name || grievance.assignedTo?.name || 'Unknown';
  const completedAt = rca.completedAt || rca.resolutionDate;
  const rcaComplete = hasCompleteRcaDetails(grievance);
  const resolutionEvidence = getResolutionEvidence(rca);
  const legacyResolutionEvidenceNotes = getLegacyResolutionEvidenceNotes(rca);
  const resolutionNotes = String(grievance.resolutionNotes || '').trim();
  const actionTaken = String(rca.actionTaken || '').trim();
  const hasDistinctResolutionNotes = resolutionNotes && resolutionNotes !== actionTaken;

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/90">Resolution Analysis</p>
            <h3 className="mt-2 text-2xl font-bold">{grievance.subject || 'Grievance RCA'}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-blue-100">
              <span className="rounded-full bg-white/15 px-3 py-1">
                Completed by {completedBy}
              </span>
              {completedAt && (
                <span className="rounded-full bg-white/15 px-3 py-1">
                  Completed on {new Date(completedAt).toLocaleString()}
                </span>
              )}
              <span className="rounded-full bg-white/15 px-3 py-1">
                Office: {formatOfficeLabel(rca.responsibleOffice || grievance.office)}
              </span>
            </div>
            {!rcaComplete && (
              <p className="mt-4 max-w-2xl rounded-2xl border border-amber-200/50 bg-white/10 px-4 py-3 text-sm text-blue-50">
                This RCA record has incomplete details. Some sections may be missing because the office resolved the case before every RCA field was saved.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => downloadRcaPdf(grievance)}
            className="rounded-xl bg-white px-4 py-2.5 font-semibold text-cyan-700 transition-colors hover:bg-cyan-50"
          >
            Download Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <InfoCard
          label="RCA Status"
          compact
          value={(
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                statusBadgeColor[rca.rcaStatus] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {(rca.rcaStatus || '--').replace('_', ' ').toUpperCase()}
            </span>
          )}
        />
        <InfoCard
          label="Root Cause Category"
          compact
          value={getRcaCategoryLabel(rca.rootCauseCategory)}
          subtle={!rca.rootCauseCategory}
        />
        <InfoCard
          label="Responsible Office"
          compact
          value={formatOfficeLabel(rca.responsibleOffice || grievance.office)}
        />
        <InfoCard
          label="Resolution Date"
          compact
          value={completedAt ? new Date(completedAt).toLocaleString() : 'Not recorded'}
          subtle={!completedAt}
        />
      </div>

      {showFishbone && (
        <SectionPanel
          title="Fishbone Analysis"
          subtitle="Possible contributing factors identified before determining the root cause."
        >
          <FishboneAnalysisPanel rca={rca} />
        </SectionPanel>
      )}

      <SectionPanel
        title="Root Cause Analysis"
        subtitle="Final root cause determination based on the reviewed contributing factors."
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Problem Summary</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {rca.problemSummary || 'No problem summary was saved for this RCA.'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Root Cause Description</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {rca.rootCauseDescription || 'No root cause description was saved for this RCA.'}
            </p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Resolution & Prevention"
        subtitle="Actions completed and controls planned to prevent recurrence."
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Action Taken</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {rca.actionTaken || 'No action taken details were saved for this RCA.'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Preventive Action</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
              {rca.preventiveAction || 'No preventive action was saved for this RCA.'}
            </p>
          </div>
        </div>
      </SectionPanel>

      {hasResolutionEvidence(rca) && (
        <SectionPanel
          title="Resolution Evidence"
          subtitle="Proof uploaded by the office to show that the grievance was already addressed."
        >
          <div className="space-y-5">
            {resolutionEvidence.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Uploaded Proof</p>
                <div className="mt-3">
                  <EvidenceAttachmentList attachments={resolutionEvidence} />
                </div>
              </div>
            )}
            {legacyResolutionEvidenceNotes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Legacy Evidence Notes</p>
                <div className="mt-3">
                  <FishboneList entries={legacyResolutionEvidenceNotes} />
                </div>
              </div>
            )}
          </div>
        </SectionPanel>
      )}

      {hasDistinctResolutionNotes && (
        <SectionPanel
          title="Resolution Notes"
          subtitle="Final resolution note shared with reviewers and the complainant."
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
            {resolutionNotes}
          </p>
        </SectionPanel>
      )}
    </div>
  );
};

export default RootCauseAnalysisView;

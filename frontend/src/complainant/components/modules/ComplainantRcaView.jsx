import {
  RCA_FISHBONE_SECTIONS,
  formatOfficeLabel,
  getFishboneEntries,
  getLegacyResolutionEvidenceNotes,
  getRcaCategoryLabel,
  getResolutionEvidence,
  hasFishboneContent,
  hasRcaContent,
  hasResolutionEvidence,
} from '../../../utils/rcaReport';
import AttachmentPreviewCard from '../../../components/AttachmentPreviewCard';

const InfoCard = ({ label, value, tone = 'slate', subtle = false }) => {
  const toneClasses = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50/80',
    blue: 'border-sky-200 bg-sky-50/80',
    violet: 'border-violet-200 bg-violet-50/80',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)] ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className={`mt-3 text-sm leading-7 ${subtle ? 'text-slate-500' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, children }) => (
  <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.28)]">
    <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.96))] px-6 py-5 text-center">
      <h4 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-slate-900">{title}</h4>
      {subtitle && <p className="mt-2 text-sm leading-7 text-slate-500">{subtitle}</p>}
    </div>
    <div className="px-6 py-6">{children}</div>
  </section>
);

const FishboneSection = ({ title, subtitle, entries }) => (
  <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.85),rgba(255,255,255,0.96))] p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.25)]">
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-500">{subtitle}</p>
    </div>
    <div className="mt-4 space-y-3">
      {entries.map((entry, index) => (
        <div
          key={`${title}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm leading-7 text-slate-800 shadow-[0_14px_34px_-34px_rgba(15,23,42,0.35)]"
        >
          {entry}
        </div>
      ))}
    </div>
  </div>
);

const EmptyFishbone = () => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
    No contributing causes recorded.
  </div>
);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');

const ComplainantRcaView = ({ grievance }) => {
  if (!hasRcaContent(grievance)) {
    return null;
  }

  const rca = grievance.rootCauseAnalysis || {};
  const completedAt = rca.resolutionDate || rca.completedAt;
  const fishboneAvailable = hasFishboneContent(rca);
  const resolutionEvidence = getResolutionEvidence(rca);
  const legacyResolutionEvidenceNotes = getLegacyResolutionEvidenceNotes(rca);
  const statusTone =
    rca.rcaStatus === 'resolved'
      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
      : 'border-amber-200 bg-amber-100 text-amber-800';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),rgba(255,255,255,0.98)_48%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.38)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Resolution Analysis</p>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-900">Fishbone, Root Cause, and Resolution Summary</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              This section separates possible contributing factors, the identified root cause, and the action completed for your case.
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${statusTone}`}>
            {(rca.rcaStatus || 'resolved').replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <InfoCard
          label="RCA Status"
          tone="emerald"
          value={
            <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${statusTone}`}>
              {(rca.rcaStatus || 'resolved').replace('_', ' ').toUpperCase()}
            </span>
          }
        />
        <InfoCard
          label="Root Cause Category"
          tone="blue"
          value={getRcaCategoryLabel(rca.rootCauseCategory)}
          subtle={!rca.rootCauseCategory}
        />
        <InfoCard
          label="Responsible Office"
          tone="violet"
          value={formatOfficeLabel(rca.responsibleOffice || grievance.office)}
        />
        <InfoCard
          label="Resolution Date"
          value={formatDateTime(completedAt)}
          subtle={!completedAt}
        />
      </div>

      <SectionCard title="Fishbone Analysis" subtitle="Possible contributing factors identified before determining the root cause.">
        {fishboneAvailable ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {RCA_FISHBONE_SECTIONS.map(({ key, title, subtitle }) => {
              const entries = getFishboneEntries(rca, key);

              if (entries.length === 0) {
                return null;
              }

              return <FishboneSection key={key} title={title} subtitle={subtitle} entries={entries} />;
            })}
          </div>
        ) : (
          <EmptyFishbone />
        )}
      </SectionCard>

      <SectionCard title="Root Cause Analysis" subtitle="Final root cause determination based on the reviewed contributing factors.">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Problem Summary</p>
            <p className="mt-4 whitespace-pre-wrap break-words text-center text-[1.05rem] leading-9 text-slate-800">
              {rca.problemSummary || 'No problem summary was saved for this RCA.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Root Cause Description</p>
            <p className="mt-4 whitespace-pre-wrap break-words text-center text-[1.05rem] leading-9 text-slate-800">
              {rca.rootCauseDescription || 'No root cause description was saved for this RCA.'}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Resolution & Prevention" subtitle="Actions completed and controls planned to prevent recurrence.">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Action Taken</p>
            <p className="mt-4 whitespace-pre-wrap break-words text-center text-[1.05rem] leading-9 text-slate-800">
              {rca.actionTaken || 'No action taken details were saved for this RCA.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Preventive Action</p>
            <p className="mt-4 whitespace-pre-wrap break-words text-center text-[1.05rem] leading-9 text-slate-800">
              {rca.preventiveAction || 'No preventive action was saved for this RCA.'}
            </p>
          </div>
        </div>
      </SectionCard>

      {hasResolutionEvidence(rca) && (
        <SectionCard title="Resolution Evidence" subtitle="Proof uploaded by the office to show that the issue was already addressed.">
          <div className="space-y-6">
            {resolutionEvidence.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Uploaded Proof</p>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {resolutionEvidence.map((attachment, index) => (
                    <AttachmentPreviewCard
                      key={`${attachment.url || attachment.fileName || index}-${index}`}
                      attachment={attachment}
                      index={index}
                      fallbackLabel="Resolution Evidence"
                      openLabel="Open Evidence"
                    />
                  ))}
                </div>
              </div>
            )}
            {legacyResolutionEvidenceNotes.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 text-center">Legacy Evidence Notes</p>
                <div className="mt-4 space-y-3">
                  {legacyResolutionEvidenceNotes.map((entry, index) => (
                    <div
                      key={`${entry}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm leading-7 text-slate-800 shadow-[0_14px_34px_-34px_rgba(15,23,42,0.35)]"
                    >
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default ComplainantRcaView;

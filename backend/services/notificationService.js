const Notification = require('../models/Notification');
const User = require('../models/User');
const { hasEmailConfig, sendEmail } = require('../utils/emailUtils');
const { getSystemSettingsSnapshot } = require('../utils/systemSettings');
const { emitNotificationCreated, emitNotificationsCreated } = require('../utils/notificationRealtime');
const { canReceiveCriticalAlerts, isActiveCriticalGrievance } = require('../utils/criticalAlerts');

const OFFICE_ACRONYM_MAP = {
  cas: 'CAS',
  cob: 'COB',
  coe: 'COE',
  col: 'COL',
  con: 'CON',
  cot: 'COT',
  cpag: 'CPAG',
  emc: 'EMC',
  esl: 'ESL',
  it: 'IT',
  ssl: 'SSL',
};

const normalizeOfficeLabel = (value = '') =>
  String(value || '')
    .trim()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

const formatOfficeReference = (value) => {
  const normalized = String(value || '').trim();

  if (!normalized || /^unassigned$/i.test(normalized)) {
    return 'UNASSIGNED';
  }

  const lowered = normalized.toLowerCase();
  const structuredMatch = lowered.match(/^(college_of_[a-z_]+)_(cpag|cas|cob|coe|con|cot|col)_(.+)$/);
  if (structuredMatch) {
    const [, collegePart, acronymKey, departmentPart] = structuredMatch;
    return `${normalizeOfficeLabel(collegePart)} (${OFFICE_ACRONYM_MAP[acronymKey]}) ${normalizeOfficeLabel(departmentPart)}`;
  }

  const collegeOnlyMatch = lowered.match(/^(college_of_[a-z_]+)_(cpag|cas|cob|coe|con|cot|col)$/);
  if (collegeOnlyMatch) {
    const [, collegePart, acronymKey] = collegeOnlyMatch;
    return `${normalizeOfficeLabel(collegePart)} (${OFFICE_ACRONYM_MAP[acronymKey]})`;
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => OFFICE_ACRONYM_MAP[part.toLowerCase()] || part.toUpperCase())
    .join(' ');
};

const formatStatus = (status) =>
  String(status || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatLabel = (value) =>
  String(value || '')
    .split(/[_/\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const escapeHtml = (value = '') =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }

  return String(value);
};

const buildStatusMessage = (grievance, actorName, status, resolutionNotes) => {
  const reference = grievance.referenceNumber || 'your grievance';
  const actorText = actorName ? ` by ${actorName}` : '';
  const noteText = resolutionNotes ? ` Notes: ${resolutionNotes}` : '';
  return `Your grievance ${reference} was updated to ${formatStatus(status)}${actorText}.${noteText}`.trim();
};

const buildReference = (grievance) => grievance?.referenceNumber || 'your grievance';

const RCA_CATEGORY_LABELS = {
  academic_performance: 'Academic Performance - Grades, coursework, academic progress',
  administrative_process: 'Administrative Process - Registration, enrollment, policies',
  personnel_conduct: 'Personnel/Conduct - Staff behavior, professionalism',
  harassment_discrimination: 'Harassment/Discrimination - Bullying, sexual harassment, discrimination',
  infrastructure_facilities: 'Infrastructure/Facilities - Buildings, equipment, utilities',
  service_quality: 'Service Quality - Support services, responsiveness',
  policy_enforcement: 'Policy Enforcement - Rule violations, inconsistent application',
  others: 'Others - Any issue not listed above',
};

const RCA_FISHBONE_SECTIONS = [
  { key: 'people', title: 'People', subtitle: 'Human actions, communication, or accountability factors' },
  { key: 'process', title: 'Process', subtitle: 'Workflow gaps, missed steps, or unclear procedures' },
  { key: 'policy', title: 'Policy', subtitle: 'Policy, rule, or enforcement-related factors' },
  { key: 'systemTechnology', title: 'System / Technology', subtitle: 'System, portal, LMS, or technical issues' },
  { key: 'environment', title: 'Environment', subtitle: 'Workload, timing, or contextual contributing factors' },
];

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString();
};

const formatRcaCategoryLabel = (value) => RCA_CATEGORY_LABELS[value] || value || '';

const sanitizeFishboneEntries = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

const sanitizeAttachmentEntries = (attachments) =>
  (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => attachment && attachment.url)
    .map((attachment, index) => ({
      url: String(attachment.url || '').trim(),
      fileName:
        String(attachment.fileName || attachment.originalName || `Resolution Evidence ${index + 1}`).trim(),
      fileType: String(attachment.fileType || attachment.format || '').trim(),
    }));

const getAttachmentExtension = (attachment = {}) => {
  const typeValue = String(attachment.fileType || '').trim().toLowerCase();
  if (typeValue) {
    const normalizedType = typeValue.split('/').pop();
    if (normalizedType) {
      return normalizedType;
    }
  }

  const nameSource = attachment.fileName || attachment.url || '';
  const match = String(nameSource).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() || '';
};

const inferAttachmentKind = (attachment = {}) => {
  const extension = getAttachmentExtension(attachment);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return 'image';
  }

  if (extension === 'pdf') {
    return 'pdf';
  }

  if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(extension)) {
    return 'video';
  }

  return 'file';
};

const getLegacyEvidenceNotes = (rca = {}) => sanitizeFishboneEntries(rca?.fishbone?.evidence);

const buildFishboneTextSections = (rca = {}) =>
  RCA_FISHBONE_SECTIONS.map(({ key, title }) => ({
    title,
    entries: sanitizeFishboneEntries(rca?.fishbone?.[key]),
  })).filter((section) => section.entries.length > 0);

const buildFishboneHtmlSections = (rca = {}) =>
  RCA_FISHBONE_SECTIONS.map(({ key, title, subtitle }) => ({
    title,
    subtitle,
    entries: sanitizeFishboneEntries(rca?.fishbone?.[key]),
  })).filter((section) => section.entries.length > 0);

const buildResolutionEvidenceHtml = (rca = {}) => {
  const attachments = sanitizeAttachmentEntries(rca?.resolutionEvidence);
  const legacyNotes = getLegacyEvidenceNotes(rca);

  if (attachments.length === 0 && legacyNotes.length === 0) {
    return { html: '', textSections: [] };
  }

  const textSections = ['', 'RESOLUTION EVIDENCE'];

  if (attachments.length > 0) {
    textSections.push('', 'Uploaded Proof:');
    textSections.push(...attachments.map((attachment) => `- ${attachment.fileName}: ${attachment.url}`));
  }

  if (legacyNotes.length > 0) {
    textSections.push('', 'Legacy Evidence Notes:');
    textSections.push(...legacyNotes.map((entry) => `- ${entry}`));
  }

  const html = `
    <div style="margin-top: 28px; border: 1px solid #dbeafe; border-radius: 18px; overflow: hidden; background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);">
      <div style="padding: 20px; border-bottom: 1px solid #dbeafe; text-align: center;">
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">Resolution Evidence</p>
        <p style="margin: 8px 0 0; color: #64748b; line-height: 1.7;">Proof uploaded by the assigned office to document that corrective action was completed.</p>
      </div>
      <div style="padding: 20px;">
        ${attachments.length > 0 ? `
          <div style="margin-bottom: ${legacyNotes.length > 0 ? '18px' : '0'};">
            ${attachments.map((attachment) => {
              const attachmentKind = inferAttachmentKind(attachment);

              return `
              <div style="border: 1px solid #cbd5e1; border-radius: 14px; background: #ffffff; padding: 14px 16px; margin-bottom: 12px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">${escapeHtml(attachment.fileName)}</p>
                ${attachment.fileType ? `<p style="margin: 6px 0 0; font-size: 12px; color: #64748b;">Type: ${escapeHtml(attachment.fileType.toUpperCase())}</p>` : ''}
                ${attachmentKind === 'image' ? `
                  <div style="margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; text-align: center;">
                    <img
                      src="${escapeHtml(attachment.url)}"
                      alt="${escapeHtml(attachment.fileName)}"
                      style="display: block; width: 100%; height: auto; max-height: 320px; object-fit: contain; background: #f8fafc;"
                    />
                  </div>
                ` : ''}
                <p style="margin: 10px 0 0;">
                  <a href="${escapeHtml(attachment.url)}" style="color: #2563eb; text-decoration: underline;">Open evidence file</a>
                </p>
              </div>
            `;
            }).join('')}
          </div>
        ` : ''}
        ${legacyNotes.length > 0 ? `
          <div style="border: 1px solid #cbd5e1; border-radius: 14px; background: #ffffff; padding: 16px;">
            <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">Legacy Evidence Notes</p>
            ${legacyNotes.map((entry) => `
              <div style="margin-top: 10px; font-size: 13px; line-height: 1.8; color: #1f2937;">${escapeHtml(entry)}</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return { html, textSections };
};

const buildResolvedRcaEmailContent = ({ grievance, reference, previousStatus, status, actorName, resolutionNotes }) => {
  const rca = grievance?.rootCauseAnalysis || {};
  const rcaRows = [
    { label: 'Reference Number', value: reference },
    { label: 'Previous Status', value: formatStatus(previousStatus || 'pending') },
    { label: 'New Status', value: formatStatus(status) },
    { label: 'Updated By', value: actorName },
    { label: 'RCA Status', value: formatStatus(rca.rcaStatus || 'resolved') },
    { label: 'Root Cause Category', value: formatRcaCategoryLabel(rca.rootCauseCategory) },
    { label: 'Responsible Office', value: rca.responsibleOffice ? formatOfficeReference(rca.responsibleOffice) : '' },
    { label: 'Resolution Date', value: formatDateTime(rca.resolutionDate) || formatDateTime(rca.completedAt) },
    { label: 'Resolution Notes', value: resolutionNotes || '' },
  ].filter((row) => row.value);

  const detailSections = [
    {
      title: 'Problem Summary',
      subtitle: 'Overview of the grievance and its impact.',
      value: String(rca.problemSummary || '').trim(),
    },
    {
      title: 'Root Cause Description',
      subtitle: 'Underlying reason identified by the assigned office.',
      value: String(rca.rootCauseDescription || '').trim(),
    },
    {
      title: 'Action Taken',
      subtitle: 'Steps already completed to address the grievance.',
      value: String(rca.actionTaken || '').trim(),
    },
    {
      title: 'Preventive Action',
      subtitle: 'Controls or changes proposed to avoid recurrence.',
      value: String(rca.preventiveAction || '').trim(),
    },
  ].filter((section) => section.value);

  const fishboneSections = buildFishboneHtmlSections(rca);
  const fishboneTextSections = buildFishboneTextSections(rca);
  const resolutionEvidenceSection = buildResolutionEvidenceHtml(rca);

  const extraTextSections = [];

  if (detailSections.length > 0) {
    extraTextSections.push('RCA DETAILS');
    extraTextSections.push(...detailSections.flatMap((section) => ['', `${section.title}:`, section.value]));
  }

  if (fishboneTextSections.length > 0) {
    extraTextSections.push('', 'FISHBONE ANALYSIS');
    extraTextSections.push(
      ...fishboneTextSections.flatMap((section) => [
        '',
        `${section.title}:`,
        ...section.entries.map((entry) => `- ${entry}`),
      ])
    );
  }

  extraTextSections.push(...resolutionEvidenceSection.textSections);

  const extraHtml = `
    ${detailSections.length > 0 ? `
      <div style="margin-top: 28px;">
        ${detailSections.map((section) => `
          <div style="border: 1px solid #dbeafe; border-radius: 18px; background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%); overflow: hidden; margin-bottom: 16px;">
            <div style="padding: 18px 20px; border-bottom: 1px solid #dbeafe; text-align: center;">
              <p style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(section.title)}</p>
              <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #64748b;">${escapeHtml(section.subtitle)}</p>
            </div>
            <div style="padding: 20px; text-align: center; font-size: 14px; line-height: 1.8; color: #1f2937; white-space: pre-wrap;">${escapeHtml(section.value)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${fishboneSections.length > 0 ? `
      <div style="margin-top: 28px; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden; background: #ffffff;">
        <div style="padding: 22px 20px 18px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Fishbone Analysis</p>
          <p style="margin: 8px 0 0; color: #64748b; line-height: 1.7;">Contributing causes grouped by RCA fishbone category.</p>
        </div>
        <div style="padding: 20px;">
          ${fishboneSections.map((section) => `
            <div style="border: 1px solid #cbd5e1; border-radius: 18px; padding: 18px; background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%); margin-bottom: 16px;">
              <p style="margin: 0; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #334155;">${escapeHtml(section.title)}</p>
              <p style="margin: 10px 0 0; text-align: center; font-size: 12px; line-height: 1.7; color: #64748b;">${escapeHtml(section.subtitle)}</p>
              <div style="margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 14px; background: #ffffff; padding: 14px;">
                ${section.entries.map((entry, index) => `
                  <div style="font-size: 13px; line-height: 1.8; color: #1f2937; text-align: center; ${index > 0 ? 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;' : ''}">
                    ${escapeHtml(entry)}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${resolutionEvidenceSection.html}
  `;

  return {
    detailRows: rcaRows,
    extraHtml,
    extraTextSections,
  };
};

const buildEmailShell = ({ heading, intro, detailRows, footerLines = [], extraHtml = '', extraTextSections = [] }) => {
  const detailsHtml = detailRows
    .filter((row) => row?.label && row?.value)
    .map(
      (row) => `
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${escapeHtml(row.label)}</td>
          <td style="padding: 8px 12px; color: #374151; border-bottom: 1px solid #e5e7eb;">${escapeHtml(row.value)}</td>
        </tr>
      `
    )
    .join('');

  const footerHtml = footerLines
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 8px; color: #4b5563;">${escapeHtml(line)}</p>`)
    .join('');

  const text = [
    heading,
    '',
    intro,
    '',
    ...detailRows
      .filter((row) => row?.label && row?.value)
      .map((row) => `${row.label}: ${row.value}`),
    ...extraTextSections.length ? ['', ...extraTextSections] : [],
    '',
    ...footerLines.filter(Boolean),
  ].join('\n');

  return {
    text,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff;">
          <h2 style="margin: 0 0 12px; color: #0f172a;">${escapeHtml(heading)}</h2>
          <p style="margin: 0 0 20px; color: #374151; line-height: 1.6;">${escapeHtml(intro)}</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tbody>${detailsHtml}</tbody>
          </table>
          ${extraHtml}
          ${footerHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated message from the Grievance Management System. Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  };
};

const canSendNotificationEmail = async () => {
  if (!hasEmailConfig()) {
    return false;
  }

  try {
    const settings = await getSystemSettingsSnapshot();
    return settings.emailNotifications !== false;
  } catch (error) {
    console.error('Failed to load system settings for email notification:', error);
    return false;
  }
};

const getPortalUrl = () => {
  const rawUrl = String(process.env.FRONTEND_URL || '').trim();
  return rawUrl ? rawUrl.replace(/\/$/, '') : '';
};

const sendCriticalCaseEmails = async ({ grievance, recipients }) => {
  const addresses = [...new Set(recipients.map((user) => String(user.email || '').trim().toLowerCase()).filter(Boolean))];
  if (!isActiveCriticalGrievance(grievance) || !addresses.length || !(await canSendNotificationEmail())) return [];
  const reference = buildReference(grievance);
  const portalUrl = getPortalUrl();
  const { html, text } = buildEmailShell({
    heading: 'Critical grievance alert',
    intro: 'A critical grievance requires your review. Sign in to view the case securely.',
    detailRows: [
      { label: 'Tracking ID', value: reference },
      { label: 'Urgency', value: 'Critical' },
      ...(portalUrl ? [{ label: 'Review case', value: portalUrl }] : []),
    ],
    footerLines: [],
    extraHtml: /^https?:\/\//i.test(portalUrl)
      ? `<p><a href="${escapeHtml(portalUrl)}">Sign in to review the case</a></p>` : '',
  });
  const results = await Promise.allSettled(addresses.map((to) => sendEmail({
    to, subject: `Critical Grievance Alert - ${reference}`, html, text,
  })));
  results.forEach((result) => {
    if (result.status === 'rejected' || result.value?.success === false) {
      console.error('Critical alert email delivery failed:', result.reason?.message || result.value?.message || 'Unknown error');
    }
  });
  return results;
};

const resolveComplainantContact = async (grievance) => {
  if (!grievance) {
    return null;
  }

  const populatedComplainant =
    grievance.complainantId && typeof grievance.complainantId === 'object'
      ? grievance.complainantId
      : null;

  const directEmail = grievance.complainantEmail || populatedComplainant?.email || null;
  const directName = grievance.complainantName || populatedComplainant?.name || 'Complainant';

  if (directEmail) {
    return {
      email: String(directEmail).trim().toLowerCase(),
      name: directName,
    };
  }

  const complainantId = getObjectIdString(grievance.complainantId);
  if (!complainantId) {
    return null;
  }

  const user = await User.findById(complainantId).select('name email').lean();
  if (!user?.email) {
    return null;
  }

  return {
    email: String(user.email).trim().toLowerCase(),
    name: user.name || directName,
  };
};

const sendComplainantEmail = async ({
  grievance,
  subject,
  heading,
  intro,
  detailRows,
  footerLines,
  extraHtml = '',
  extraTextSections = [],
}) => {
  if (!(await canSendNotificationEmail())) {
    return { success: false, skipped: true, message: 'Email notifications are disabled or not configured' };
  }

  try {
    const complainant = await resolveComplainantContact(grievance);
    if (!complainant?.email) {
      return { success: false, skipped: true, message: 'No complainant email available' };
    }

    const greetingName = grievance?.isAnonymous
      ? 'Complainant'
      : complainant.name || 'Complainant';

    const { html, text } = buildEmailShell({
      heading,
      intro: `Hello ${greetingName}, ${intro}`,
      detailRows,
      footerLines,
      extraHtml,
      extraTextSections,
    });

    return sendEmail({
      to: complainant.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('Failed to send complainant email notification:', error);
    return { success: false, message: 'Failed to send complainant email notification', error: error.message };
  }
};

const createNotification = async ({
  recipient,
  type,
  title,
  message,
  relatedUser = null,
  relatedGrievance = null,
}) => {
  if (!recipient || !type || !title || !message) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    relatedUser,
    relatedGrievance,
  });

  await emitNotificationCreated(notification);
  return notification;
};

const notifyComplainantGrievanceSubmitted = async ({ grievance, actor }) => {
  if (!grievance?.complainantId) {
    return null;
  }

  return createNotification({
    recipient: grievance.complainantId,
    type: 'grievance_submitted',
    title: 'Grievance Submitted',
    message: `Your grievance ${grievance.referenceNumber} has been submitted successfully and is awaiting review.`,
    relatedUser: actor?._id || null,
    relatedGrievance: grievance._id,
  });
};

const notifyAdminsGrievanceSubmitted = async ({ grievance, actor }) => {
  if (!grievance?._id) {
    return [];
  }

  const actorId = getObjectIdString(actor?._id);
  const admins = await User.find({
    role: { $in: ['admin', 'superadmin'] },
    status: 'active',
  }).select('_id').lean();

  const recipients = admins.filter((admin) => getObjectIdString(admin._id) !== actorId);
  if (!recipients.length) {
    return [];
  }

  const reference = buildReference(grievance);
  const notifications = await Notification.insertMany(
    recipients.map((admin) => ({
      recipient: admin._id,
      type: 'grievance_submitted',
      title: 'New Grievance Received',
      message: `A new grievance ${reference} was submitted and is awaiting review.`,
      relatedUser: null,
      relatedGrievance: grievance._id,
    }))
  );

  await emitNotificationsCreated(notifications);
  return notifications;
};

const notifyAdminsCriticalGrievanceDetected = async ({
  grievance,
  actor,
  aiAnalysis,
  reAlert = false,
}) => {
  if (!grievance?._id) {
    return { success: false, skipped: true, message: 'No grievance provided' };
  }

  if (!isActiveCriticalGrievance(grievance)) {
    return { success: false, skipped: true, message: 'Grievance urgency is not critical' };
  }

  const staff = await User.find({
    role: { $in: ['admin', 'superadmin'] },
    status: 'active',
  }).select('_id name email role permissions').lean();
  const recipients = staff.filter(canReceiveCriticalAlerts);

  if (!recipients.length) {
    return { success: false, skipped: true, message: 'No authorized admin recipients found' };
  }

  const reference = buildReference(grievance);
  const alertMessage = `Grievance ${reference} is classified as critical and requires immediate review.`;
  const notifications = [];
  // Reuse each recipient's alert on retries; a new critical transition reopens it.
  for (const recipient of recipients) {
    const filter = {
      recipient: recipient._id,
      relatedGrievance: grievance._id,
      title: 'Critical Grievance Alert',
      type: 'grievance_submitted',
    };
    const update = reAlert
      ? { $set: { message: alertMessage, read: false, seen: false, acknowledgedAt: null } }
      : { $setOnInsert: { message: alertMessage, read: false, seen: false, acknowledgedAt: null } };
    const result = await Notification.findOneAndUpdate(filter, update, {
      upsert: true, new: true, rawResult: true, setDefaultsOnInsert: true,
    });
    if (reAlert || !result.lastErrorObject?.updatedExisting) notifications.push(result.value);
  }

  await emitNotificationsCreated(notifications);
  if (!notifications.length) {
    return { success: true, skipped: true, notificationsCreated: 0 };
  }

  const emailRecipients = [...new Set(
    recipients
      .map((recipient) => String(recipient.email || '').trim().toLowerCase())
      .filter(Boolean)
  )];

  const emailResults = await sendCriticalCaseEmails({ grievance, recipients });

  return {
    success: true,
    notificationsCreated: notifications.length,
    emailRecipients: emailRecipients.length,
    emailResults,
  };
};

const notifyComplainantGrievanceAssigned = async ({ grievance, actor, assignee }) => {
  if (!grievance?.complainantId) {
    return null;
  }

  const assigneeText = assignee?.name
    ? ` and assigned to ${assignee.name}`
    : grievance.assignedTo?.name
      ? ` and assigned to ${grievance.assignedTo.name}`
      : '';

  const notification = await createNotification({
    recipient: grievance.complainantId,
    type: 'grievance_assigned',
    title: 'Grievance Assigned',
    message: `Your grievance ${grievance.referenceNumber} is now being handled${assigneeText}.`,
    relatedUser: actor?._id || assignee?._id || null,
    relatedGrievance: grievance._id,
  });

  const reference = buildReference(grievance);
  const actorName = actor?.name || 'an administrator';
  const assigneeName = assignee?.name || grievance.assignedTo?.name || 'the assigned office';
  const officeLabel = grievance.office ? formatOfficeReference(grievance.office) : null;

  await sendComplainantEmail({
    grievance,
    subject: `Grievance Assignment Update - ${reference}`,
    heading: 'Your grievance has been assigned',
    intro: `your grievance ${reference} is now being handled.`,
    detailRows: [
      { label: 'Reference Number', value: reference },
      { label: 'Current Status', value: formatStatus(grievance.status || 'assigned_to_department') },
      { label: 'Assigned By', value: actorName },
      { label: 'Assigned To', value: assigneeName },
      { label: 'Office', value: officeLabel },
    ],
    footerLines: [
      'You can log in to the Grievance Management System to view the latest handling details.',
    ],
  });

  return notification;
};

const notifyComplainantGrievanceStatusUpdated = async ({
  grievance,
  actor,
  previousStatus,
  status,
  resolutionNotes = '',
}) => {
  if (!grievance?.complainantId || !status || previousStatus === status) {
    return null;
  }

  const notification = await createNotification({
    recipient: grievance.complainantId,
    type: 'grievance_status_updated',
    title: 'Grievance Status Updated',
    message: buildStatusMessage(grievance, actor?.name, status, resolutionNotes),
    relatedUser: actor?._id || null,
    relatedGrievance: grievance._id,
  });

  const reference = buildReference(grievance);
  const actorName = actor?.name || 'a staff member';
  const resolvedEmailContent =
    status === 'resolved'
      ? buildResolvedRcaEmailContent({
          grievance,
          reference,
          previousStatus,
          status,
          actorName,
          resolutionNotes,
        })
      : null;

  await sendComplainantEmail({
    grievance,
    subject: `Grievance Status Update - ${reference}`,
    heading: 'Your grievance status was updated',
    intro: `the status of grievance ${reference} has changed.`,
    detailRows: resolvedEmailContent?.detailRows || [
      { label: 'Reference Number', value: reference },
      { label: 'Previous Status', value: formatStatus(previousStatus || 'pending') },
      { label: 'New Status', value: formatStatus(status) },
      { label: 'Updated By', value: actorName },
      { label: 'Resolution Notes', value: resolutionNotes },
    ],
    extraHtml: resolvedEmailContent?.extraHtml || '',
    extraTextSections: resolvedEmailContent?.extraTextSections || [],
    footerLines: [
      'You can log in to the Grievance Management System to review the latest update on your case.',
    ],
  });

  return notification;
};

const notifyAdminsGrievanceStatusUpdated = async ({
  grievance,
  actor,
  status,
  resolutionNotes = '',
}) => {
  if (!grievance?._id || !status) {
    return null;
  }

  const admins = await User.find({
    role: { $in: ['admin', 'superadmin'] },
    status: 'active',
  }).select('_id').lean();

  if (!admins.length) {
    return [];
  }

  const actorName = actor?.name || 'an office user';
  const noteText = resolutionNotes ? ` Notes: ${resolutionNotes}` : '';
  const title = status === 'resolved' ? 'Grievance Resolved' : 'Grievance Status Updated';
  const message = `Grievance ${grievance.referenceNumber} was updated to ${formatStatus(status)} by ${actorName}.${noteText}`.trim();

  const notifications = await Notification.insertMany(
    admins.map((admin) => ({
      recipient: admin._id,
      type: 'grievance_status_updated',
      title,
      message,
      relatedUser: actor?._id || null,
      relatedGrievance: grievance._id,
    }))
  );

  await emitNotificationsCreated(notifications);
  return notifications;
};

const notifyComplainantGrievanceArchived = async ({
  grievance,
  actor,
  reason = '',
  archiveType = 'deleted',
}) => {
  if (!grievance?.complainantId) {
    return null;
  }

  const reasonText = reason ? ` Reason: ${reason}` : '';
  const actionText = archiveType === 'rejected' ? 'rejected and archived' : 'archived';

  return createNotification({
    recipient: grievance.complainantId,
    type: 'grievance_archived',
    title: 'Grievance Archived',
    message: `Your grievance ${grievance.referenceNumber} was ${actionText} by ${actor?.name || 'an administrator'}.${reasonText}`.trim(),
    relatedUser: actor?._id || null,
    relatedGrievance: grievance._id,
  });
};

const notifyOfficeHandlerVerified = async ({ user, actor }) => {
  if (!user?._id) {
    return null;
  }

  return createNotification({
    recipient: user._id,
    type: 'office_handler_verified',
    title: 'Account Verified',
    message: 'Your office staff account has been verified. You can now manage assigned grievances.',
    relatedUser: actor?._id || null,
  });
};

const notifyOfficeHandlerAssignment = async ({ grievance, assignee, actor }) => {
  if (!assignee?._id || !grievance?._id) {
    return null;
  }

  const notification = await createNotification({
    recipient: assignee._id,
    type: 'office_handler_assignment',
    title: 'New Grievance Assigned',
    message: `A new grievance ${grievance.referenceNumber} has been assigned to you for handling.`,
    relatedUser: actor?._id || null,
    relatedGrievance: grievance._id,
  });
  await sendCriticalCaseEmails({ grievance, recipients: [assignee] });
  return notification;
};

const notifyOfficeHandlersGrievanceRouted = async ({ grievance, officeValues = [], actor }) => {
  if (!grievance?._id) {
    return [];
  }

  const normalizedOfficeValues = [...new Set(
    officeValues
      .concat([grievance.office])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];

  if (!normalizedOfficeValues.length) {
    return [];
  }

  const handlers = await User.find({
    role: 'office_handler',
    status: 'active',
    isVerified: true,
    $or: normalizedOfficeValues.map((value) => ({
      office: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })),
  }).select('_id email').lean();

  if (!handlers.length) {
    return [];
  }

  const notifications = await Notification.insertMany(
    handlers.map((handler) => ({
      recipient: handler._id,
      type: 'office_handler_assignment',
      title: 'New Grievance Assigned',
      message: `A new grievance ${grievance.referenceNumber} has been assigned to your office for handling.`,
      relatedUser: actor?._id || null,
      relatedGrievance: grievance._id,
    }))
  );

  await emitNotificationsCreated(notifications);
  await sendCriticalCaseEmails({ grievance, recipients: handlers });
  return notifications;
};

const notifyOfficeHandlerOfficeUpdated = async ({ user, actor, previousOffice, nextOffice }) => {
  if (!user?._id || previousOffice === nextOffice) {
    return null;
  }

  return createNotification({
    recipient: user._id,
    type: 'office_handler_office_updated',
    title: 'Office Assignment Updated',
    message: `Your office assignment was updated from ${formatOfficeReference(previousOffice)} to ${formatOfficeReference(nextOffice)}.`,
    relatedUser: actor?._id || null,
  });
};

module.exports = {
  formatStatus,
  notifyComplainantGrievanceAssigned,
  notifyComplainantGrievanceArchived,
  notifyComplainantGrievanceStatusUpdated,
  notifyComplainantGrievanceSubmitted,
  notifyAdminsGrievanceSubmitted,
  notifyAdminsGrievanceStatusUpdated,
  notifyOfficeHandlerAssignment,
  notifyOfficeHandlersGrievanceRouted,
  notifyOfficeHandlerOfficeUpdated,
  notifyOfficeHandlerVerified,
  notifyAdminsCriticalGrievanceDetected,
};

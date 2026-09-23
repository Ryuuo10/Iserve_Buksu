import logoAsset from '../assets/pdf-logo.png';

export const RCA_CATEGORY_LABELS = {
  academic_performance: 'Academic Performance - Grades, coursework, academic progress',
  administrative_process: 'Administrative Process - Registration, enrollment, policies',
  personnel_conduct: 'Personnel/Conduct - Staff behavior, professionalism',
  harassment_discrimination: 'Harassment/Discrimination - Bullying, sexual harassment, discrimination',
  infrastructure_facilities: 'Infrastructure/Facilities - Buildings, equipment, utilities',
  service_quality: 'Service Quality - Support services, responsiveness',
  policy_enforcement: 'Policy Enforcement - Rule violations, inconsistent application',
  others: 'Others - Any issue not listed above',
};

export const RCA_FISHBONE_SECTIONS = [
  { key: 'people', title: 'People', subtitle: 'Human actions, communication, or accountability factors' },
  { key: 'process', title: 'Process', subtitle: 'Workflow gaps, missed steps, or unclear procedures' },
  { key: 'policy', title: 'Policy', subtitle: 'Policy, rule, or enforcement-related factors' },
  { key: 'systemTechnology', title: 'System / Technology', subtitle: 'System, portal, LMS, or technical issues' },
  { key: 'environment', title: 'Environment', subtitle: 'Workload, timing, or contextual contributing factors' },
];

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

const RCA_FIELDS = [
  'problemSummary',
  'rootCauseCategory',
  'rootCauseDescription',
  'actionTaken',
  'preventiveAction',
  'responsibleOffice',
  'resolutionDate',
  'rcaStatus',
  'completedAt',
];

const RCA_REQUIRED_DETAIL_FIELDS = [
  'problemSummary',
  'rootCauseCategory',
  'rootCauseDescription',
  'actionTaken',
  'preventiveAction',
];

export const hasRcaContent = (source) => {
  const rca = source?.rootCauseAnalysis || source;

  if (!rca || typeof rca !== 'object') {
    return false;
  }

  const hasFishboneEntries = RCA_FISHBONE_SECTIONS.some(({ key }) =>
    Array.isArray(rca?.fishbone?.[key]) && rca.fishbone[key].some((value) => String(value || '').trim())
  );

  if (hasFishboneEntries) {
    return true;
  }

  const hasUploadedEvidence =
    Array.isArray(rca?.resolutionEvidence) && rca.resolutionEvidence.some((attachment) => attachment?.url);

  if (hasUploadedEvidence) {
    return true;
  }

  const hasLegacyResolutionEvidence =
    Array.isArray(rca?.fishbone?.evidence) && rca.fishbone.evidence.some((value) => String(value || '').trim());

  if (hasLegacyResolutionEvidence) {
    return true;
  }

  return RCA_FIELDS.some((field) => {
    const value = rca[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
};

export const hasCompleteRcaDetails = (source) => {
  const rca = source?.rootCauseAnalysis || source;

  if (!rca || typeof rca !== 'object') {
    return false;
  }

  return RCA_REQUIRED_DETAIL_FIELDS.every((field) => {
    const value = rca[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
};

export const getRcaCategoryLabel = (value) => RCA_CATEGORY_LABELS[value] || value || '--';

export const getFishboneEntries = (rca, key) =>
  (Array.isArray(rca?.fishbone?.[key]) ? rca.fishbone[key] : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

export const hasFishboneContent = (rca) =>
  RCA_FISHBONE_SECTIONS.some(({ key }) => getFishboneEntries(rca, key).length > 0);

export const getResolutionEvidence = (source) => {
  const rca = source?.rootCauseAnalysis || source;

  return (Array.isArray(rca?.resolutionEvidence) ? rca.resolutionEvidence : [])
    .filter((attachment) => attachment && attachment.url)
    .map((attachment, index) => ({
      url: String(attachment.url || '').trim(),
      publicId: attachment.publicId ? String(attachment.publicId).trim() : null,
      fileName: String(attachment.fileName || attachment.originalName || `Resolution Evidence ${index + 1}`).trim(),
      fileType: String(attachment.fileType || attachment.format || '').trim(),
      size: Number.isFinite(attachment.size) ? attachment.size : null,
    }));
};

export const getLegacyResolutionEvidenceNotes = (source) => {
  const rca = source?.rootCauseAnalysis || source;
  return (Array.isArray(rca?.fishbone?.evidence) ? rca.fishbone.evidence : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
};

export const hasResolutionEvidence = (source) =>
  getResolutionEvidence(source).length > 0 || getLegacyResolutionEvidenceNotes(source).length > 0;

const getAttachmentExtension = (attachment = {}) => {
  const fromType = String(attachment.fileType || '').trim().toLowerCase();
  if (fromType) {
    return fromType;
  }

  const nameSource = attachment.fileName || attachment.url || '';
  const match = String(nameSource).match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() || '';
};

export const inferAttachmentKind = (attachment = {}) => {
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

export const getAttachmentDisplayName = (attachment = {}, index = 0, fallbackLabel = 'Attachment') => {
  const rawName = String(attachment.fileName || '').trim();
  const extension = getAttachmentExtension(attachment);
  const kind = inferAttachmentKind(attachment);

  if (rawName) {
    const looksGenerated = /^\d[\d-]*\.[a-z0-9]+$/i.test(rawName) || /^file-\d[\d-]*\.[a-z0-9]+$/i.test(rawName);
    if (!looksGenerated) {
      return rawName;
    }
  }

  if (kind === 'image') {
    return `${fallbackLabel} image${extension ? `.${extension}` : ''}`;
  }

  if (kind === 'pdf') {
    return `${fallbackLabel} PDF`;
  }

  if (kind === 'video') {
    return `${fallbackLabel} video${extension ? `.${extension}` : ''}`;
  }

  return rawName || `${fallbackLabel} ${index + 1}${extension ? `.${extension}` : ''}`;
};

export const resolveAttachmentUrl = (attachment = {}) => {
  const rawUrl = String(attachment.url || '').trim();
  if (!rawUrl) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(rawUrl)) {
    return rawUrl;
  }

  if (rawUrl.startsWith('/uploads/')) {
    return `${BACKEND_BASE_URL}${rawUrl}`;
  }

  if (rawUrl.startsWith('uploads/')) {
    return `${BACKEND_BASE_URL}/${rawUrl}`;
  }

  if (/^[^/\\]+\.[a-z0-9]+$/i.test(rawUrl)) {
    return `${BACKEND_BASE_URL}/uploads/${rawUrl}`;
  }

  return `${BACKEND_BASE_URL}/${rawUrl.replace(/^\/+/, '')}`;
};

export const formatOfficeLabel = (value) =>
  String(value || '--')
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || '--';

const formatReportDateTime = (value) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const normalizePdfText = (value) =>
  String(value ?? '--')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/\r/g, '');

const safeFileName = (value) =>
  String(value || 'Grievance-Report')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character;
    })
    .join('')
    .replace(/\s+/g, '_')
    .slice(0, 120);

const loadAssetAsDataUrl = async (assetUrl) => {
  if (!assetUrl || typeof window === 'undefined') {
    return null;
  }

  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`Unable to load asset: ${assetUrl}`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read asset: ${assetUrl}`));
    reader.readAsDataURL(blob);
  });
};

const setDrawColor = (doc, [r, g, b]) => doc.setDrawColor(r, g, b);
const setTextColor = (doc, [r, g, b]) => doc.setTextColor(r, g, b);

const splitMultilineText = (doc, text, maxWidth) =>
  normalizePdfText(text)
    .split('\n')
    .flatMap((paragraph, index, paragraphs) => {
      const trimmed = paragraph.trim();
      const wrapped = trimmed ? doc.splitTextToSize(trimmed, maxWidth) : [''];
      return index < paragraphs.length - 1 ? [...wrapped, ''] : wrapped;
    });

const getTranscriptSource = (grievance) => {
  if (Array.isArray(grievance?.conversationTranscript)) {
    return grievance.conversationTranscript;
  }

  if (Array.isArray(grievance?.conversation)) {
    return grievance.conversation;
  }

  if (Array.isArray(grievance?.chatHistory)) {
    return grievance.chatHistory;
  }

  return [];
};

export const normalizeConversationTranscript = (grievance) =>
  getTranscriptSource(grievance)
    .map((entry, index) => {
      const rawSender = String(entry?.sender || entry?.role || '').trim().toLowerCase();
      const sender = rawSender === 'assistant' || rawSender === 'bot' ? 'bot' : rawSender === 'user' ? 'user' : '';
      const message = String(entry?.message || entry?.text || entry?.content || '').trim();
      const timestampValue = entry?.timestamp || entry?.createdAt || entry?.time;
      const timestamp = timestampValue ? new Date(timestampValue) : null;

      if (!sender || !message) {
        return null;
      }

      return {
        id: `${sender}-${timestampValue || index}-${index}`,
        sender,
        message,
        timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (!left.timestamp || !right.timestamp) return 0;
      return left.timestamp.getTime() - right.timestamp.getTime();
    });

export const downloadRcaPdf = async (grievance) => {
  const rca = grievance?.rootCauseAnalysis;

  if (!grievance || typeof window === 'undefined') {
    return;
  }

  const referenceNumber = grievance.referenceNumber || grievance.trackingId || grievance.grievanceId || 'Grievance-Report';
  const officeName = formatOfficeLabel(rca?.responsibleOffice || grievance.office || 'N/A');
  const complainantName = grievance.isAnonymous
    ? 'Anonymous'
    : grievance.complainantName || grievance.complainantId?.name || 'N/A';
  const complainantCollege = grievance.college || grievance.office || 'N/A';
  const complainantDepartment = grievance.department || 'N/A';
  const officeHandlerName =
    grievance.signatories?.officeHandler?.name ||
    rca?.completedBy?.name ||
    grievance.handlingLockedBy?.name ||
    grievance.assignedTo?.name ||
    'Office Handler';
  const officeHandlerPosition =
    grievance.signatories?.officeHandler?.position ||
    'Office Handler';
  const clientCareCenterHeadName =
    grievance.signatories?.clientCareCenterHead?.name ||
    grievance.signatories?.head?.name ||
    grievance.clientCareCenterHead?.name ||
    grievance.clientCareHead?.name ||
    grievance.approvedBy?.name ||
    'Client Care Center Head';
  const clientCareCenterHeadPosition =
    grievance.signatories?.clientCareCenterHead?.position ||
    grievance.signatories?.head?.position ||
    grievance.clientCareCenterHead?.position ||
    grievance.clientCareHead?.position ||
    'Head';
  const dateAssigned = grievance.assignedAt || grievance.departmentAssignedAt || grievance.officeReceivedAt;
  const dateResolved = grievance.resolvedAt || rca?.resolutionDate || rca?.completedAt;
  const generatedAt = formatReportDateTime(new Date());
  const statusLabel = String(grievance.status || 'N/A')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
  const priorityLabel = String(grievance.priority || 'N/A')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
  const attachments = Array.isArray(grievance.attachments) ? grievance.attachments : [];
  const attachmentSummary =
    attachments.length === 0
      ? 'None'
      : attachments
        .map((attachment, index) => getAttachmentDisplayName(attachment, index, 'Attachment'))
        .slice(0, 4)
        .join(', ') + (attachments.length > 4 ? `, and ${attachments.length - 4} more` : '');
  const statementOfConcern = normalizePdfText(grievance.description || grievance.originalDescription || 'N/A')
    .split('\n')
    .filter((line) => !/^\s*(Incident Date|Office|Department)\s*:/i.test(line))
    .join('\n')
    .trim() || 'N/A';
  const actionTaken = rca?.actionTaken || grievance.resolutionNotes || 'N/A';
  let resolutionTime = 'N/A';

  if (grievance.createdAt && dateResolved) {
    const createdAt = new Date(grievance.createdAt);
    const resolvedAt = new Date(dateResolved);

    if (!Number.isNaN(createdAt.getTime()) && !Number.isNaN(resolvedAt.getTime()) && resolvedAt >= createdAt) {
      const totalHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      resolutionTime = `${totalHours.toFixed(1)} hours`;
    }
  }

  try {
    const [{ jsPDF }, logoDataUrl] = await Promise.all([
      import('jspdf'),
      loadAssetAsDataUrl(logoAsset).catch(() => null),
    ]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const layout = {
      pageWidth: doc.internal.pageSize.getWidth(),
      pageHeight: doc.internal.pageSize.getHeight(),
      left: 9,
      right: 9,
      top: 12,
      bottom: 15,
      contentWidth: doc.internal.pageSize.getWidth() - 18,
    };
    const fieldLabelWidth = 43;
    const fieldValueX = layout.left + fieldLabelWidth;
    const fieldValueWidth = layout.contentWidth - fieldLabelWidth;
    const pageContentBottom = layout.pageHeight - layout.bottom - 8;
    const lineHeight = 4;
    const fieldGap = 5.2;
    const transcriptMessages = normalizeConversationTranscript(grievance);

    const renderFooter = () => {
      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(
        'This is a system-generated report. No erasures or alterations',
        layout.pageWidth / 2,
        layout.pageHeight - 8,
        { align: 'center' }
      );
    };

    let y = layout.top;

    const ensureSpace = (heightNeeded) => {
      if (y + heightNeeded > pageContentBottom) {
        renderFooter();
        doc.addPage();
        y = layout.top;
      }
    };

    const divider = () => {
      setDrawColor(doc, [0, 0, 0]);
      doc.setLineWidth(0.25);
      doc.line(layout.left, y, layout.pageWidth - layout.right, y);
      y += 5.5;
    };

    const labelValue = (label, value, x, lineY, width = fieldValueWidth, valueOffset = fieldLabelWidth) => {
      const lines = splitMultilineText(doc, value, width);

      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${normalizePdfText(label)}:`, x, lineY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(lines, x + valueOffset, lineY);

      return lines.length;
    };

    const sectionTitle = (title) => {
      ensureSpace(10);
      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(normalizePdfText(title), layout.left, y);
      y += 5.5;
    };

    const singleField = (label, value, width = fieldValueWidth, valueOffset = fieldLabelWidth) => {
      ensureSpace(6);
      const lineCount = labelValue(label, value, layout.left, y, width, valueOffset);
      y += Math.max(fieldGap, lineCount * lineHeight);
    };

    const paragraphField = (label, value) => {
      const labelText = `${normalizePdfText(label)}:`;
      const lines = splitMultilineText(doc, value, fieldValueWidth);
      ensureSpace(8 + (lines.length * lineHeight));

      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(labelText, layout.left, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(lines, fieldValueX, y);
      y += Math.max(fieldGap, lines.length * lineHeight);
    };

    const transcriptLayout = {
      left: 13,
      right: 13,
      top: 15,
      bottom: 16,
      get contentWidth() {
        return layout.pageWidth - this.left - this.right;
      },
      get contentBottom() {
        return layout.pageHeight - this.bottom - 8;
      },
    };
    const transcriptSizingOptions = [
      { fontSize: 8, labelSize: 7.5, lineHeight: 3.6, labelGap: 3.4, messageGap: 2.8 },
      { fontSize: 7.5, labelSize: 7.25, lineHeight: 3.4, labelGap: 3.2, messageGap: 2.5 },
      { fontSize: 7, labelSize: 7, lineHeight: 3.25, labelGap: 3, messageGap: 2.3 },
      { fontSize: 6.5, labelSize: 6.75, lineHeight: 3.1, labelGap: 2.8, messageGap: 2 },
    ];
    const transcriptMessageWidth = transcriptLayout.contentWidth * 0.84;

    const getTranscriptLines = (message, sizing) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(sizing.fontSize);
      return splitMultilineText(doc, message.message, transcriptMessageWidth);
    };

    const getTranscriptHeaderHeight = () => 17.5;

    const getTranscriptBlockHeight = (message, sizing) =>
      sizing.labelGap + (getTranscriptLines(message, sizing).length * sizing.lineHeight) + sizing.messageGap;

    const getTranscriptContentHeight = (sizing) => {
      if (transcriptMessages.length === 0) {
        return getTranscriptHeaderHeight() + 8;
      }

      return transcriptMessages.reduce(
        (total, message) => total + getTranscriptBlockHeight(message, sizing),
        getTranscriptHeaderHeight()
      );
    };

    const selectTranscriptSizing = () => {
      const availableHeight = transcriptLayout.contentBottom - transcriptLayout.top;

      return transcriptSizingOptions.find((sizing) => getTranscriptContentHeight(sizing) <= availableHeight)
        || transcriptSizingOptions[transcriptSizingOptions.length - 1];
    };

    const renderTranscriptHeader = () => {
      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('GRIEVANCE CONVERSATION TRANSCRIPT', layout.pageWidth / 2, y, { align: 'center' });
      y += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Case No.: ${normalizePdfText(referenceNumber)}`, layout.pageWidth / 2, y, { align: 'center' });
      y += 5;
      setDrawColor(doc, [0, 0, 0]);
      doc.setLineWidth(0.2);
      doc.line(transcriptLayout.left, y, layout.pageWidth - transcriptLayout.right, y);
      y += 4;
    };

    const continueTranscriptPage = () => {
      renderFooter();
      doc.addPage();
      y = transcriptLayout.top;
      renderTranscriptHeader();
    };

    const renderTranscriptMessage = (message, sizing, allowContinuation) => {
      const isUser = message.sender === 'user';
      const label = isUser ? 'User:' : 'Bot:';
      const x = isUser ? layout.pageWidth - transcriptLayout.right - transcriptMessageWidth : transcriptLayout.left;
      const textAlign = isUser ? 'right' : 'left';
      const textX = isUser ? x + transcriptMessageWidth : x;
      const lines = getTranscriptLines(message, sizing);
      let lineIndex = 0;
      let shouldPrintLabel = true;

      while (lineIndex < lines.length) {
        const labelHeight = shouldPrintLabel ? sizing.labelGap : 0;
        const availableHeight = transcriptLayout.contentBottom - y - labelHeight - sizing.messageGap;
        const linesThatFit = Math.max(1, Math.floor(availableHeight / sizing.lineHeight));
        const remainingLines = lines.length - lineIndex;
        const chunkSize = Math.min(remainingLines, linesThatFit);
        const blockHeight = labelHeight + (chunkSize * sizing.lineHeight) + sizing.messageGap;

        if (y + blockHeight > transcriptLayout.contentBottom && availableHeight < sizing.lineHeight && allowContinuation) {
          continueTranscriptPage();
          continue;
        }

        setTextColor(doc, [0, 0, 0]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(sizing.labelSize);

        if (shouldPrintLabel) {
          doc.text(label, textX, y, { align: textAlign });
          y += sizing.labelGap;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sizing.fontSize);
        doc.text(
          lines.slice(lineIndex, lineIndex + chunkSize),
          textX,
          y,
          { align: textAlign, lineHeightFactor: sizing.lineHeight / sizing.fontSize }
        );
        y += (chunkSize * sizing.lineHeight) + sizing.messageGap;

        lineIndex += chunkSize;
        shouldPrintLabel = false;

        if (lineIndex < lines.length && allowContinuation) {
          continueTranscriptPage();
        }
      }
    };

    const renderTranscript = () => {
      const sizing = selectTranscriptSizing();
      const transcriptFitsOnePage =
        getTranscriptContentHeight(sizing) <= transcriptLayout.contentBottom - transcriptLayout.top;

      doc.addPage();
      y = transcriptLayout.top;
      renderTranscriptHeader();

      if (transcriptMessages.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sizing.fontSize);
        doc.text(
          'No chatbot conversation transcript is available for this grievance.',
          transcriptLayout.left,
          y
        );
        return;
      }

      transcriptMessages.forEach((message) => renderTranscriptMessage(message, sizing, !transcriptFitsOnePage));
    };

    const renderSignatories = () => {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SIGNATORIES', layout.left, y);

      y += 13;
      const signatureWidth = 50;
      const leftSignatureX = 18.5;
      const rightSignatureX = layout.pageWidth - 27 - signatureWidth;
      const leftSignatureCenter = leftSignatureX + (signatureWidth / 2);
      const rightSignatureCenter = rightSignatureX + (signatureWidth / 2);
      setDrawColor(doc, [0, 0, 0]);
      setTextColor(doc, [0, 0, 0]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(normalizePdfText(officeHandlerName), leftSignatureCenter, y, { align: 'center' });
      doc.text(normalizePdfText(clientCareCenterHeadName), rightSignatureCenter, y, { align: 'center' });

      doc.setLineWidth(0.35);
      doc.line(leftSignatureX, y + 4.5, leftSignatureX + signatureWidth, y + 4.5);
      doc.line(rightSignatureX, y + 4.5, rightSignatureX + signatureWidth, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(normalizePdfText(officeHandlerPosition), leftSignatureCenter, y + 9.5, { align: 'center' });
      doc.text(normalizePdfText(clientCareCenterHeadPosition), rightSignatureCenter, y + 9.5, { align: 'center' });
      doc.text(`(${normalizePdfText(officeName)})`, leftSignatureCenter, y + 14.5, { align: 'center' });
      doc.text('Client Care Center', rightSignatureCenter, y + 14.5, { align: 'center' });
      y += 22;
    };

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 30, 11, 22, 22);
    }

    setTextColor(doc, [0, 0, 0]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('BUKIDNON STATE UNIVERSITY', layout.pageWidth / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Malaybalay City, Bukidnon 8700', layout.pageWidth / 2, 24, { align: 'center' });
    doc.text('Tel (088) 813-5661 to 5663, www.buksu.edu.ph', layout.pageWidth / 2, 29, { align: 'center' });

    y = 43;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('OFFICIAL  GRIEVANCE REPORT FORM', layout.pageWidth / 2, y, { align: 'center' });
    y += 9;

    labelValue('Grievance Case No.', referenceNumber, layout.left, y, 62, 41);
    labelValue('Date Generated', generatedAt, 118, y, 72, 37);
    y += 6;
    labelValue('Priority', priorityLabel, layout.left, y, 82, 20);
    y += 5;
    divider();

    sectionTitle('COMPLAINANT INFORMATION:');
    singleField('Name', complainantName);
    singleField('College', complainantCollege);
    singleField('Department', complainantDepartment);
    divider();

    sectionTitle('GRIEVANCE INFORMATION:');
    singleField('Category', grievance.category || 'N/A');
    singleField('Subject', grievance.subject || 'N/A');
    singleField('Date Filed', formatReportDateTime(grievance.createdAt));
    singleField('Attachments', attachmentSummary);
    paragraphField('Statement of Concern', statementOfConcern);
    divider();

    sectionTitle('HANDLING INFORMATION:');
    singleField('Assigned Office', officeName);
    singleField('Office Handler', officeHandlerName);
    singleField('Date Assigned', formatReportDateTime(dateAssigned));
    divider();

    sectionTitle('ACTION TAKEN:');
    paragraphField('Action Taken', actionTaken);
    singleField('Date Resolved', formatReportDateTime(dateResolved));
    divider();

    const statusY = y;
    sectionTitle('RESOLUTION STATUS:');
    labelValue('Status', statusLabel, layout.left, y, 70, 18);
    y = statusY;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('AVERAGE RESOLUTION TIME:', 112, y);
    y += 5.5;
    labelValue('Time', resolutionTime, 112, y, 70, 16);
    y += 7;
    divider();

    renderSignatories();
    renderFooter();
    renderTranscript();
    renderFooter();
    doc.save(`Grievance_Report_${safeFileName(referenceNumber)}.pdf`);
  } catch (error) {
    console.error('Unable to generate grievance report PDF:', error);
  }
};

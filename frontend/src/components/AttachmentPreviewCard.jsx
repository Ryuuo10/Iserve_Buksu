import { useState } from 'react';
import {
  getAttachmentDisplayName,
  inferAttachmentKind,
  resolveAttachmentUrl,
} from '../utils/rcaReport';
import ImageLightbox from './ImageLightbox';

const formatFileSize = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentPreviewCard = ({
  attachment,
  index = 0,
  fallbackLabel = 'Attachment',
  openLabel = 'Open Attachment',
  className = '',
}) => {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const url = resolveAttachmentUrl(attachment);
  const fileName = getAttachmentDisplayName(attachment, index, fallbackLabel);
  const attachmentKind = inferAttachmentKind(attachment);
  const metadata = [attachment.fileType, formatFileSize(attachment.size)].filter(Boolean).join(' | ');
  const isImage = attachmentKind === 'image';

  return (
    <div
      className={`rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.25)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{fileName}</p>
          {metadata ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metadata}</p>
          ) : null}
        </div>
        {url ? (
          isImage ? (
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              View Photo
            </button>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {openLabel}
            </a>
          )
        ) : null}
      </div>

      {url && isImage && !previewFailed ? (
        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="mt-4 block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left"
          aria-label={`View ${fileName}`}
        >
          <img
            src={url}
            alt={fileName}
            className="max-h-[22rem] w-full bg-slate-100 object-contain"
            onError={() => setPreviewFailed(true)}
          />
        </button>
      ) : null}

      {url && attachmentKind === 'pdf' && !previewFailed ? (
        <iframe
          src={url}
          title={fileName}
          className="mt-4 h-80 w-full rounded-2xl border border-slate-200 bg-white"
          onError={() => setPreviewFailed(true)}
        />
      ) : null}

      {url && attachmentKind === 'video' && !previewFailed ? (
        <video controls className="mt-4 w-full rounded-2xl border border-slate-200 bg-black">
          <source src={url} onError={() => setPreviewFailed(true)} />
          Your browser does not support the video tag.
        </video>
      ) : null}

      {((!url || attachmentKind === 'file') || previewFailed) ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-7 text-slate-600">
          {previewFailed
            ? 'Preview is not available for this file here. Use the button above to open it.'
            : 'Inline preview is not available for this file type.'}
          </div>
      ) : null}

      <ImageLightbox
        isOpen={isLightboxOpen}
        src={url}
        alt={fileName}
        title={fileName}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  );
};

export default AttachmentPreviewCard;

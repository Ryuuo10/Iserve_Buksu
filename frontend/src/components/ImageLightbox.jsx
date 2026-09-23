import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const ImageLightbox = ({ isOpen, src, alt = 'Image preview', title = 'Image Preview', onClose }) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-5xl rounded-2xl bg-white p-3 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close image preview"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="flex max-h-[calc(92vh-4.5rem)] items-center justify-center overflow-hidden rounded-xl bg-slate-950/5">
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(92vh-4.5rem)] max-w-full object-contain"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageLightbox;

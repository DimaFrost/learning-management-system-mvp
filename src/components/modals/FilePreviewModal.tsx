import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react';
import type { FilePreviewItem } from '../../utils/filePreview';

interface FilePreviewModalProps {
  item: FilePreviewItem | null;
  onClose: () => void;
}

function PreviewIcon({ mode }: { mode: FilePreviewItem['mode'] }) {
  if (mode === 'image') return <ImageIcon className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function FilePreviewModal({ item, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    setFailed(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
      if (item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
    };
  }, [item, onClose]);

  if (!item) return null;

  const downloadName = item.fileName ?? item.title;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close preview"
      />

      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:h-[min(92vh,900px)] sm:rounded-2xl sm:ring-1 sm:ring-[#e5e5e5]">
        <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#f5f5f5] text-[#525252] ring-1 ring-[#e5e5e5]">
              <PreviewIcon mode={item.mode} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-[#171717] sm:text-lg">{item.title}</h2>
              <p className="mt-0.5 text-xs text-[#737373] sm:text-sm">{item.typeLabel} · Opens in platform preview</p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <a
              href={item.downloadUrl}
              download={downloadName}
              target="_blank"
              rel="noopener noreferrer"
              className="tbo-focus hidden items-center gap-1.5 rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] sm:inline-flex"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tbo-focus hidden items-center gap-1.5 rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm font-medium text-[#525252] hover:bg-[#f5f5f5] md:inline-flex"
            >
              <ExternalLink className="h-4 w-4" />
              Open in tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="tbo-focus grid h-9 w-9 place-items-center rounded-lg text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[#f5f5f5]">
          {loading && !failed && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#fafafa]">
              <div className="flex items-center gap-2 text-sm text-[#737373]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading preview…
              </div>
            </div>
          )}

          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-medium text-[#171717]">We couldn&apos;t load a preview for this file.</p>
              <p className="max-w-md text-sm text-[#737373]">
                You can still download it or open it in a new browser tab.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href={item.downloadUrl}
                  download={downloadName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#262626]"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4d4d4] px-4 py-2 text-sm font-semibold text-[#525252] hover:bg-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in tab
                </a>
              </div>
            </div>
          ) : item.mode === 'image' ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img
                src={item.previewUrl}
                alt={item.title}
                className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-sm ring-1 ring-[#e5e5e5]"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            </div>
          ) : (
            <iframe
              title={item.title}
              src={item.previewUrl}
              className="h-full w-full border-0 bg-white"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e5e5e5] bg-white px-4 py-3 sm:hidden">
          <a
            href={item.downloadUrl}
            download={downloadName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#171717] px-3 py-2 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#d4d4d4] px-3 py-2 text-sm font-semibold text-[#525252]"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

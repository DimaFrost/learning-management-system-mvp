import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface AvatarCropModalProps {
  file: File;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
  saving: boolean;
}

export function AvatarCropModal({
  file,
  onClose,
  onCropComplete,
  saving,
}: AvatarCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const VIEWPORT_SIZE = 280;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  };

  const baseScale =
    naturalSize.width > 0
      ? Math.max(
          VIEWPORT_SIZE / naturalSize.width,
          VIEWPORT_SIZE / naturalSize.height
        )
      : 1;
  const effectiveScale = baseScale * zoom;

  const clampOffset = useCallback(
    (x: number, y: number, scale: number) => {
      const scaledWidth = naturalSize.width * scale;
      const scaledHeight = naturalSize.height * scale;
      const maxX = Math.max(0, (scaledWidth - VIEWPORT_SIZE) / 2);
      const maxY = Math.max(0, (scaledHeight - VIEWPORT_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [naturalSize]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const newOffset = clampOffset(
        dragStart.current.offsetX + dx,
        dragStart.current.offsetY + dy,
        effectiveScale
      );
      setOffset(newOffset);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, effectiveScale, clampOffset]);

  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y, effectiveScale));
  }, [zoom, effectiveScale, clampOffset]);

  const handleSave = () => {
    if (!imgRef.current || naturalSize.width === 0) return;

    const OUTPUT_SIZE = 400;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputScale = OUTPUT_SIZE / VIEWPORT_SIZE;
    const scaledWidth = naturalSize.width * effectiveScale * outputScale;
    const scaledHeight = naturalSize.height * effectiveScale * outputScale;

    const drawX = (OUTPUT_SIZE - scaledWidth) / 2 + offset.x * outputScale;
    const drawY = (OUTPUT_SIZE - scaledHeight) / 2 + offset.y * outputScale;

    ctx.drawImage(imgRef.current, drawX, drawY, scaledWidth, scaledHeight);

    canvas.toBlob(
      blob => {
        if (blob) onCropComplete(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Adjust Photo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          className="relative mx-auto rounded-lg overflow-hidden bg-gray-100 select-none"
          style={{
            width: VIEWPORT_SIZE,
            height: VIEWPORT_SIZE,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {imageUrl && (
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={handleImageLoad}
              draggable={false}
              alt="Crop preview"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: naturalSize.width * effectiveScale,
                height: naturalSize.height * effectiveScale,
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                pointerEvents: 'none',
              }}
            />
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              borderRadius: '50%',
              width: VIEWPORT_SIZE,
              height: VIEWPORT_SIZE,
            }}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        <p className="text-xs text-gray-500 text-center mt-2">
          Drag to reposition · Use slider to zoom
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || naturalSize.width === 0}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

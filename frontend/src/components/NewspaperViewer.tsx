import { useState } from 'react';

interface NewspaperViewerProps {
  imageUrl: string;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  pageNumber?: number;
  totalPages?: number;
}

export default function NewspaperViewer({
  imageUrl,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
  pageNumber,
  totalPages,
}: NewspaperViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(0.5, Math.min(3, zoom + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // imageUrl이 변경되면 에러 상태 리셋
  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [imageUrl]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '80vh',
        overflow: 'hidden',
        background: '#f0f0f0',
        border: '1px solid var(--border-color)',
        borderRadius: '0.5rem',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${zoom})`,
          transition: isDragging ? 'none' : 'transform 0.1s',
        }}
      >
        {imageError ? (
          <div
            style={{
              width: '600px',
              height: '800px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f0f0f0',
              border: '2px dashed #ccc',
              borderRadius: '0.5rem',
              color: '#666',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              이미지를 불러올 수 없습니다
            </div>
            <div style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              URL: {imageUrl.substring(0, 100)}...
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setImageError(false);
                setImageLoading(true);
                // Force image reload by adding timestamp
                const img = document.querySelector('img[data-page-image]') as HTMLImageElement;
                if (img) {
                  img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
                }
              }}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <img
            data-page-image
            src={imageUrl}
            alt={`Page ${pageNumber}`}
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              objectFit: 'contain',
              userSelect: 'none',
              display: imageLoading ? 'none' : 'block',
            }}
            onLoad={() => {
              console.log('[NewspaperViewer] Image loaded successfully:', imageUrl);
              setImageLoading(false);
              setImageError(false);
            }}
            onError={(e) => {
              console.error('[NewspaperViewer] Image load error:', {
                imageUrl,
                pageNumber,
                error: e,
              });
              setImageError(true);
              setImageLoading(false);
            }}
          />
        )}
        {imageLoading && !imageError && (
          <div
            style={{
              width: '600px',
              height: '800px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f0f0f0',
              color: '#666',
            }}
          >
            <div>이미지 로딩 중...</div>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => setZoom(Math.min(3, zoom + 0.1))}
        >
          +
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
        >
          −
        </button>
        <button className="btn btn-secondary" onClick={resetZoom}>
          리셋
        </button>
      </div>

      {pageNumber && totalPages && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
          }}
        >
          {pageNumber} / {totalPages}
        </div>
      )}

      {hasPrev && (
        <button
          className="btn btn-primary"
          onClick={onPrev}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          ← 이전
        </button>
      )}

      {hasNext && (
        <button
          className="btn btn-primary"
          onClick={onNext}
          style={{
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          다음 →
        </button>
      )}
    </div>
  );
}


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
        <img
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            objectFit: 'contain',
            userSelect: 'none',
          }}
        />
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


import React, { useRef, useCallback, useEffect } from 'react';
import type { TextLayer } from '../types';
import { TextLayerComponent } from './TextLayerComponent';

interface CanvasEditorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  layers: TextLayer[];
  selectedLayerId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  onSelectLayer: (id: string | null) => void;
  onStartDrag: (id: string, clientX: number, clientY: number, canvasRect: DOMRect) => void;
  onDoDrag: (clientX: number, clientY: number, canvasRect: DOMRect) => void;
  onEndDrag: () => void;
  onStartResize: (id: string, handle: string, clientX: number, clientY: number, canvasRect: DOMRect) => void;
  onDoResize: (clientX: number, clientY: number, canvasRect: DOMRect) => void;
  onEndResize: () => void;
}

/** Извлекает координаты из Mouse или Touch события */
function getClientCoords(e: React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } {
  if ('touches' in e) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export function CanvasEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  layers,
  selectedLayerId,
  isDragging,
  isResizing,
  onSelectLayer,
  onStartDrag,
  onDoDrag,
  onEndDrag,
  onStartResize,
  onDoResize,
  onEndResize,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });

  // Calculate canvas size to fit the viewport while maintaining aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current.parentElement!;
      const maxWidth = container.clientWidth - 40;
      const maxHeight = window.innerHeight - 200;

      const aspectRatio = imageWidth / imageHeight;
      let width = maxWidth;
      let height = width / aspectRatio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageWidth, imageHeight]);

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { clientX, clientY } = getClientCoords(e);

      if (isDragging) {
        onDoDrag(clientX, clientY, rect);
      }
      if (isResizing) {
        onDoResize(clientX, clientY, rect);
      }
    },
    [isDragging, isResizing, onDoDrag, onDoResize]
  );

  const handlePointerUp = useCallback(() => {
    if (isDragging) onEndDrag();
    if (isResizing) onEndResize();
  }, [isDragging, isResizing, onEndDrag, onEndResize]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Deselect if clicking on the canvas background
      if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG') {
        onSelectLayer(null);
      }
    },
    [onSelectLayer]
  );

  return (
    <div
      className="canvas-editor"
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      <div
        ref={containerRef}
        className="canvas-container"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
        }}
        onClick={handleCanvasClick}
      >
        <img
          src={imageUrl}
          alt="Base image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          draggable={false}
        />

        {layers.map((layer) => (
          <TextLayerComponent
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedLayerId}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            onSelect={onSelectLayer}
            onStartDrag={(id, clientX, clientY) => {
              if (!containerRef.current) return;
              onStartDrag(id, clientX, clientY, containerRef.current.getBoundingClientRect());
            }}
            onStartResize={(id, handle, clientX, clientY) => {
              if (!containerRef.current) return;
              onStartResize(id, handle, clientX, clientY, containerRef.current.getBoundingClientRect());
            }}
          />
        ))}
      </div>
    </div>
  );
}

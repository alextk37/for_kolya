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
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
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
  onUpdateLayer,
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDragging) {
        onDoDrag(e.clientX, e.clientY, rect);
      }
      if (isResizing) {
        onDoResize(e.clientX, e.clientY, rect);
      }
    },
    [isDragging, isResizing, onDoDrag, onDoResize]
  );

  const handleMouseUp = useCallback(() => {
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
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={containerRef}
        className="canvas-container"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          position: 'relative',
          overflow: 'hidden',
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
            onUpdate={onUpdateLayer}
          />
        ))}
      </div>
    </div>
  );
}

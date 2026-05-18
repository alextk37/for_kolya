import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { TextLayer, CsvData } from '../types';
import {
  renderScene,
  hitTestLayer,
  hitTestResizeHandle,
} from '../utils/canvasRenderer';

interface CanvasEditorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  layers: TextLayer[];
  selectedLayerId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  csvData: CsvData;
  previewRowIndex: number;
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
  csvData,
  previewRowIndex,
  onSelectLayer,
  onStartDrag,
  onDoDrag,
  onEndDrag,
  onStartResize,
  onDoResize,
  onEndResize,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Загрузка изображения для Canvas-рендеринга
  useEffect(() => {
    const img = new Image();
    if (imageUrl.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image for canvas preview');
      setImageLoaded(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

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

  // Рендерим сцену на Canvas при каждом изменении
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Учитываем devicePixelRatio для чёткости
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    // Масштабируем контекст для отображения полного изображения в canvasSize
    const scaleX = canvasSize.width / imageWidth;
    const scaleY = canvasSize.height / imageHeight;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    renderScene(ctx, {
      width: imageWidth,
      height: imageHeight,
      layers,
      csvData,
      rowIndex: previewRowIndex,
      image: imageRef.current,
      drawSelection: true,
      selectedLayerId,
      respectVisibility: true,
    });

    ctx.restore();
  }, [canvasSize, imageWidth, imageHeight, layers, csvData, previewRowIndex, selectedLayerId, imageLoaded]);

  // Преобразование координат мыши в координаты изображения
  const clientToImageCoords = useCallback(
    (clientX: number, clientY: number): { imgX: number; imgY: number } => {
      if (!containerRef.current) return { imgX: 0, imgY: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = imageWidth / rect.width;
      const scaleY = imageHeight / rect.height;
      return {
        imgX: (clientX - rect.left) * scaleX,
        imgY: (clientY - rect.top) * scaleY,
      };
    },
    [imageWidth, imageHeight]
  );

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
      const { clientX, clientY } = getClientCoords(e);
      const { imgX, imgY } = clientToImageCoords(clientX, clientY);

      // Проверяем ручки ресайза выбранного слоя
      if (selectedLayerId) {
        const selectedLayer = layers.find((l) => l.id === selectedLayerId);
        if (selectedLayer) {
          const handle = hitTestResizeHandle(selectedLayer, imgX, imgY);
          if (handle) {
            if (!containerRef.current) return;
            onStartResize(selectedLayer.id, handle, clientX, clientY, containerRef.current.getBoundingClientRect());
            return;
          }
        }
      }

      // Проверяем попадание по слоям (сверху вниз по z-order)
      const sortedLayers = [...layers]
        .filter((l) => l.visible)
        .sort((a, b) => b.order - a.order);

      for (const layer of sortedLayers) {
        if (hitTestLayer(layer, imgX, imgY)) {
          onSelectLayer(layer.id);

          // Начинаем перетаскивание, если слой не заблокирован
          if (!layer.locked && containerRef.current) {
            onStartDrag(layer.id, clientX, clientY, containerRef.current.getBoundingClientRect());
          }
          return;
        }
      }

      // Клик по пустому месту — снимаем выделение
      onSelectLayer(null);
    },
    [selectedLayerId, layers, clientToImageCoords, onSelectLayer, onStartDrag, onStartResize]
  );

  // Определяем курсор в зависимости от позиции мыши
  const [cursorStyle, setCursorStyle] = useState<string>('default');

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging || isResizing) {
        handlePointerMove(e);
        return;
      }

      const { clientX, clientY } = getClientCoords(e);
      const { imgX, imgY } = clientToImageCoords(clientX, clientY);

      // Проверяем ручки ресайза выбранного слоя
      if (selectedLayerId) {
        const selectedLayer = layers.find((l) => l.id === selectedLayerId);
        if (selectedLayer && !selectedLayer.locked) {
          const handle = hitTestResizeHandle(selectedLayer, imgX, imgY);
          if (handle) {
            const cursorMap: Record<string, string> = {
              nw: 'nw-resize',
              n: 'n-resize',
              ne: 'ne-resize',
              w: 'w-resize',
              e: 'e-resize',
              sw: 'sw-resize',
              s: 's-resize',
              se: 'se-resize',
            };
            setCursorStyle(cursorMap[handle] || 'default');
            return;
          }
        }
      }

      // Проверяем попадание по слоям
      const sortedLayers = [...layers]
        .filter((l) => l.visible && !l.locked)
        .sort((a, b) => b.order - a.order);

      let overLayer = false;
      for (const layer of sortedLayers) {
        if (hitTestLayer(layer, imgX, imgY)) {
          overLayer = true;
          break;
        }
      }

      setCursorStyle(overLayer ? 'move' : 'default');
    },
    [isDragging, isResizing, selectedLayerId, layers, clientToImageCoords, handlePointerMove]
  );

  return (
    <div
      className="canvas-editor"
      onMouseMove={handleMouseMove}
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
          cursor: cursorStyle,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasClick}
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

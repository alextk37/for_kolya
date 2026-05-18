import { useRef, useCallback, useEffect } from 'react';
import type { TextLayer } from '../types';
import { drawBarcodeOnCanvas } from '../utils/drawBarcode';

interface TextLayerComponentProps {
  layer: TextLayer;
  isSelected: boolean;
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: (id: string) => void;
  onStartDrag: (id: string, clientX: number, clientY: number) => void;
  onStartResize: (id: string, handle: string, clientX: number, clientY: number) => void;
}

/** Извлекает координаты из Mouse или Touch события */
function getClientCoords(e: React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } {
  if ('touches' in e) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export function TextLayerComponent({
  layer,
  isSelected,
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  onSelect,
  onStartDrag,
  onStartResize,
}: TextLayerComponentProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  const scaleX = canvasWidth / imageWidth;
  const scaleY = canvasHeight / imageHeight;

  // Генерируем штрихкод для превью
  useEffect(() => {
    if (!layer.isBarcode || !barcodeCanvasRef.current) return;

    const targetCanvas = barcodeCanvasRef.current;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    // Размеры canvas в CSS-пикселях (отображаемая область слоя)
    const w = targetCanvas.clientWidth || 260;
    const h = targetCanvas.clientHeight || 60;

    // Учитываем devicePixelRatio для чёткости на ретина-экранах
    const dpr = window.devicePixelRatio || 1;
    targetCanvas.width = w * dpr;
    targetCanvas.height = h * dpr;
    targetCanvas.style.width = `${w}px`;
    targetCanvas.style.height = `${h}px`;

    // Масштабируем ctx так, чтобы логические координаты = CSS-пиксели
    ctx.scale(dpr, dpr);

    // Рисуем превью через общий хелпер (тот же алгоритм, что при генерации)
    const previewValue = '7693732300000';
    try {
      drawBarcodeOnCanvas(ctx, previewValue, 0, 0, w, h, layer.barcodeOptions);
    } catch (err) {
      console.error('JsBarcode preview error:', err);
      ctx.fillStyle = '#ff4444';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EAN13: ошибка', w / 2, h / 2);
    }
  }, [layer.isBarcode, layer.barcodeOptions]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: layer.x * scaleX,
    top: layer.y * scaleY,
    width: layer.width * scaleX,
    height: layer.height * scaleY,
    border: isSelected
      ? '2px solid #d4af37'
      : '1px solid rgba(255,255,255,0.12)',
    backgroundColor: isSelected
      ? 'rgba(212, 175, 55, 0.06)'
      : 'rgba(255,255,255,0.02)',
    cursor: 'move',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
    borderRadius: '3px',
    padding: '4px 6px',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    zIndex: isSelected ? 10 : 1,
    boxShadow: isSelected
      ? '0 0 16px rgba(212, 175, 55, 0.15), inset 0 0 16px rgba(212, 175, 55, 0.03)'
      : 'none',
    transition: 'box-shadow 0.15s, border-color 0.15s, background-color 0.15s',
    transform: `rotate(${layer.rotation}deg)`,
    transformOrigin: 'center center',
  };

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const { clientX, clientY } = getClientCoords(e);
      onSelect(layer.id);
      onStartDrag(layer.id, clientX, clientY);
    },
    [layer.id, onSelect, onStartDrag]
  );

  const handleResizePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      const { clientX, clientY } = getClientCoords(e);
      onSelect(layer.id);
      onStartResize(layer.id, handle, clientX, clientY);
    },
    [layer.id, onSelect, onStartResize]
  );

  // Двойной клик — выделяет слой (все настройки доступны в LayerPanel)
  const handleDoubleClick = useCallback(() => {
    onSelect(layer.id);
  }, [layer.id, onSelect]);

  const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      ref={layerRef}
      style={style}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      className="text-layer"
      title={
        layer.isBarcode
          ? `[ШТРИХКОД] ${layer.columnName} | Поворот: ${layer.rotation}°`
          : `${layer.columnName} | Поворот: ${layer.rotation}°`
      }
    >
      {layer.isBarcode ? (
        <canvas
          ref={barcodeCanvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            textAlign: layer.textAlign,
            overflow: 'hidden',
            pointerEvents: 'none',
            lineHeight: 1.3,
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            fontWeight: layer.fontStyle.includes('bold') ? '700' : '400',
            fontStyle: layer.fontStyle.includes('italic') ? 'italic' : 'normal',
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize * Math.min(scaleX, scaleY),
            color: layer.color,
          }}
        >
          {layer.columnName}
        </span>
      )}

      {isSelected &&
        resizeHandles.map((handle) => (
          <div
            key={handle}
            className={`resize-handle resize-handle--${handle}`}
            onMouseDown={(e) => handleResizePointerDown(e, handle)}
            onTouchStart={(e) => handleResizePointerDown(e, handle)}
          />
        ))}
    </div>
  );
}

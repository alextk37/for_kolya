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
  onUpdate: (id: string, updates: Partial<TextLayer>) => void;
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
  onUpdate,
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
    zIndex: isSelected ? 10 : 1,
    boxShadow: isSelected
      ? '0 0 16px rgba(212, 175, 55, 0.15), inset 0 0 16px rgba(212, 175, 55, 0.03)'
      : 'none',
    transition: 'box-shadow 0.15s, border-color 0.15s, background-color 0.15s',
    transform: `rotate(${layer.rotation}deg)`,
    transformOrigin: 'center center',
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect(layer.id);
      onStartDrag(layer.id, e.clientX, e.clientY);
    },
    [layer.id, onSelect, onStartDrag]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect(layer.id);
      onStartResize(layer.id, handle, e.clientX, e.clientY);
    },
    [layer.id, onSelect, onStartResize]
  );

  const handleDoubleClick = useCallback(() => {
    if (layer.isBarcode) {
      const newWidth = prompt('Ширина полосы (1-10):', String(layer.barcodeOptions.width));
      if (newWidth) onUpdate(layer.id, { barcodeOptions: { ...layer.barcodeOptions, width: parseInt(newWidth) || 1 } });

      const newHeight = prompt('Высота штрихкода (10-200):', String(layer.barcodeOptions.height));
      if (newHeight) onUpdate(layer.id, { barcodeOptions: { ...layer.barcodeOptions, height: parseInt(newHeight) || 40 } });

      const newRotation = prompt('Поворот (градусы, 0-360):', String(layer.rotation));
      if (newRotation) onUpdate(layer.id, { rotation: parseInt(newRotation) || 0 });
      return;
    }

    const newColor = prompt('Цвет текста (hex, например #ff0000):', layer.color);
    if (newColor) onUpdate(layer.id, { color: newColor });

    const newFontSize = prompt('Размер шрифта:', String(layer.fontSize));
    if (newFontSize) onUpdate(layer.id, { fontSize: parseInt(newFontSize) || 16 });

    const newFontFamily = prompt('Шрифт:', layer.fontFamily);
    if (newFontFamily) onUpdate(layer.id, { fontFamily: newFontFamily });

    const newAlign = prompt('Выравнивание (left, center, right):', layer.textAlign);
    if (newAlign && ['left', 'center', 'right'].includes(newAlign)) {
      onUpdate(layer.id, { textAlign: newAlign as CanvasTextAlign });
    }

    const newStyle = prompt('Стиль (normal, bold, italic, bold italic):', layer.fontStyle);
    if (newStyle) onUpdate(layer.id, { fontStyle: newStyle });

    const newRotation = prompt('Поворот (градусы, 0-360):', String(layer.rotation));
    if (newRotation) onUpdate(layer.id, { rotation: parseInt(newRotation) || 0 });
  }, [layer, onUpdate]);

  const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      ref={layerRef}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="text-layer"
      title={
        layer.isBarcode
          ? `[ШТРИХКОД] ${layer.columnName} | Поворот: ${layer.rotation}° | Двойной клик для настроек`
          : `${layer.columnName} | Поворот: ${layer.rotation}° | Двойной клик для настроек`
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
            onMouseDown={(e) => handleResizeMouseDown(e, handle)}
          />
        ))}
    </div>
  );
}

import JsBarcode from 'jsbarcode';
import type { BarcodeOptions } from '../types';

/**
 * Очищает значение EAN-13: оставляет только цифры, обрезает/дополняет до 13 символов.
 */
function sanitizeEan13(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13) {
    return digits.padStart(13, '0');
  }
  return digits.slice(0, 13);
}

/**
 * Рисует EAN-13 штрихкод на canvas.
 *
 * Алгоритм:
 *  1. barWidth = floor((width - 2*margin) / 95) — подбираем ширину полосы
 *     так, чтобы штрихкод заполнял всю доступную ширину слоя.
 *  2. barHeight вычисляется из высоты слоя с учётом текста и отступов.
 *  3. JsBarcode рендерит на временный canvas с этими параметрами (без DPR).
 *  4. Результат вписывается в слой с сохранением пропорций.
 *     imageSmoothingEnabled=false — чёткие полосы без размытия.
 */
export function drawBarcodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: BarcodeOptions
): void {
  try {
    const cleanValue = sanitizeEan13(value);
    const margin = Math.max(0, options.margin);

    // EAN-13 состоит из 95 модулей (полосы + пробелы).
    // barWidth подбираем так, чтобы занять максимум доступной ширины.
    const EAN13_MODULES = 95;
    const availableWidth = width - 2 * margin;
    const barWidth = Math.max(1, Math.floor(availableWidth / EAN13_MODULES));

    // Высота полос: вся высота минус отступы и, если нужно, зона текста.
    const fontSize = options.displayValue ? Math.max(8, Math.round(height * 0.15)) : 0;
    const barHeight = Math.max(
      10,
      Math.round(height - 2 * margin - (options.displayValue ? fontSize + 4 : 0))
    );

    const tempCanvas = document.createElement('canvas');

    JsBarcode(tempCanvas, cleanValue, {
      format: 'EAN13',
      width: barWidth,
      height: barHeight,
      displayValue: options.displayValue,
      fontSize: fontSize,
      lineColor: options.lineColor,
      background: options.background,
      margin: margin,
      flat: false,
    });

    const barcodeW = tempCanvas.width;
    const barcodeH = tempCanvas.height;

    if (barcodeW <= 0 || barcodeH <= 0) {
      throw new Error('Invalid barcode dimensions');
    }

    // Вписываем в слой с сохранением пропорций.
    // imageSmoothingEnabled=false — полосы остаются чёткими.
    const scaleX = width / barcodeW;
    const scaleY = height / barcodeH;
    const scale = Math.min(scaleX, scaleY);

    const drawW = barcodeW * scale;
    const drawH = barcodeH * scale;
    const drawX = x + (width - drawW) / 2;
    const drawY = y + (height - drawH) / 2;

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.imageSmoothingEnabled = prevSmoothing;
  } catch {
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.font = `${Math.min(14, height * 0.3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Ошибка EAN13: ${value}`, x + width / 2, y + height / 2);
    ctx.restore();
  }
}

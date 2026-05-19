import JsBarcode from 'jsbarcode';
import type { BarcodeOptions } from '../types';

/**
 * Вычисляет контрольную цифру для EAN-13 по стандартному алгоритму.
 * Принимает 12 цифр, возвращает 13-ю (контрольную) цифру.
 */
function calculateEan13CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    // Нечётные позиции (1,3,5...) — коэффициент 1, чётные — коэффициент 3
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check;
}

/**
 * Проверяет и исправляет значение EAN-13.
 *
 * Правила:
 *  - Если цифр < 12 — выбрасываем ошибку (недостаточно данных)
 *  - Если цифр = 12 — вычисляем контрольную сумму (13-ю цифру)
 *  - Если цифр = 13 — проверяем контрольную сумму
 *  - Если цифр > 13 — обрезаем до 13 и проверяем
 *
 * Возвращает валидный 13-символьный EAN-13 код.
 */
function sanitizeEan13(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.length < 12) {
    throw new Error(`Слишком мало цифр для EAN-13: ${digits.length} (нужно минимум 12)`);
  }

  if (digits.length === 12) {
    // Вычисляем контрольную цифру
    const checkDigit = calculateEan13CheckDigit(digits);
    return digits + checkDigit;
  }

  if (digits.length === 13) {
    // Проверяем контрольную цифру
    const checkDigit = calculateEan13CheckDigit(digits.slice(0, 12));
    const actualCheck = parseInt(digits[12], 10);
    if (checkDigit !== actualCheck) {
      throw new Error(`Неверная контрольная сумма EAN-13: ожидается ${checkDigit}, получено ${actualCheck}`);
    }
    return digits;
  }

  // Больше 13 цифр — обрезаем до 13 и проверяем
  const truncated = digits.slice(0, 13);
  const checkDigit = calculateEan13CheckDigit(truncated.slice(0, 12));
  const actualCheck = parseInt(truncated[12], 10);
  if (checkDigit !== actualCheck) {
    throw new Error(`Неверная контрольная сумма EAN-13 после обрезания: ожидается ${checkDigit}, получено ${actualCheck}`);
  }
  return truncated;
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

    // Вычисляем итоговые отступы: если индивидуальные отступы = 0, используем общий margin
    const marginTop = options.marginTop || options.margin;
    const marginBottom = options.marginBottom || options.margin;
    const marginLeft = options.marginLeft || options.margin;
    const marginRight = options.marginRight || options.margin;

    // EAN-13 состоит из 95 модулей (полосы + пробелы).
    // barWidth подбираем так, чтобы занять максимум доступной ширины.
    const EAN13_MODULES = 95;
    const availableWidth = width - marginLeft - marginRight;
    const barWidth = Math.max(1, Math.floor(availableWidth / EAN13_MODULES));

    // Высота полос: вся высота минус отступы и, если нужно, зона текста.
    const fontSize = options.displayValue
      ? Math.max(8, options.fontSize || Math.round(height * 0.15))
      : 0;
    const textMargin = options.displayValue ? Math.max(0, options.textMargin) : 0;
    const barHeight = Math.max(
      10,
      Math.round(height - marginTop - marginBottom - (options.displayValue ? fontSize + textMargin : 0))
    );

    const tempCanvas = document.createElement('canvas');

    JsBarcode(tempCanvas, cleanValue, {
      format: 'EAN13',
      width: barWidth,
      height: barHeight,
      displayValue: options.displayValue,
      fontSize: fontSize,
      font: options.fontFamily || 'Inter',
      textMargin: textMargin,
      textAlign: options.textAlign || 'center',
      lineColor: options.lineColor,
      background: options.background,
      margin: 0, // Мы управляем отступами вручную через позиционирование
      flat: false,
    });

    const barcodeW = tempCanvas.width;
    const barcodeH = tempCanvas.height;

    if (barcodeW <= 0 || barcodeH <= 0) {
      throw new Error('Invalid barcode dimensions');
    }

    // Вписываем в слой с учётом индивидуальных отступов.
    // imageSmoothingEnabled=false — полосы остаются чёткими.
    const availW = width - marginLeft - marginRight;
    const availH = height - marginTop - marginBottom;
    const scaleX = availW / barcodeW;
    const scaleY = availH / barcodeH;
    const scale = Math.min(scaleX, scaleY);

    const drawW = barcodeW * scale;
    const drawH = barcodeH * scale;
    // Позиционируем с учётом отступов и выравнивания по центру
    const drawX = x + marginLeft + (availW - drawW) / 2;
    const drawY = y + marginTop + (availH - drawH) / 2;

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.imageSmoothingEnabled = prevSmoothing;
  } catch (err) {
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.font = `${Math.min(14, height * 0.3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const message = err instanceof Error ? err.message : String(err);
    ctx.fillText(`Ошибка EAN13: ${message}`, x + width / 2, y + height / 2);
    ctx.restore();
  }
}

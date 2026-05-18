/**
 * Единый Canvas-рендерер для предпросмотра и генерации изображений.
 * Гарантирует WYSIWYG — что видишь в предпросмотре = что получишь при генерации.
 */
import type { TextLayer, CsvData } from '../types';
import { drawBarcodeOnCanvas } from './drawBarcode';

/** Настройки рендеринга сцены */
export interface RenderSceneOptions {
  /** Ширина изображения в пикселях */
  width: number;
  /** Высота изображения в пикселях */
  height: number;
  /** Слои для рендеринга */
  layers: TextLayer[];
  /** Данные CSV */
  csvData: CsvData;
  /** Индекс строки CSV для подстановки данных (0-based) */
  rowIndex: number;
  /** Фоновое изображение */
  image: HTMLImageElement;
  /** Рисовать ли рамки выделения вокруг слоёв (для предпросмотра) */
  drawSelection?: boolean;
  /** ID выбранного слоя (для рамки выделения) */
  selectedLayerId?: string | null;
  /** Рисовать ли только видимые слои (true для генерации, false для предпросмотра) */
  respectVisibility?: boolean;
}

/**
 * Рендерит полную сцену на canvas: фоновое изображение + все текстовые слои.
 * Используется и для предпросмотра, и для генерации.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  options: RenderSceneOptions
): void {
  const {
    width,
    height,
    layers,
    csvData,
    rowIndex,
    image,
    drawSelection = false,
    selectedLayerId = null,
    respectVisibility = true,
  } = options;

  // Очищаем canvas
  ctx.clearRect(0, 0, width, height);

  // Рисуем фоновое изображение
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).imageSmoothingQuality = 'high';
  }
  ctx.drawImage(image, 0, 0, width, height);

  // Получаем данные строки CSV
  const row = csvData.rows[rowIndex] || [];

  // Сортируем слои по order для правильного z-order
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  // Рендерим каждый слой
  for (const layer of sortedLayers) {
    // Пропускаем скрытые слои (если respectVisibility = true)
    if (respectVisibility && !layer.visible) continue;

    const cellValue = row[layer.columnIndex];
    if (!cellValue || cellValue.trim() === '') {
      // Даже если значение пустое, рисуем рамку выделения в предпросмотре
      if (drawSelection && layer.id === selectedLayerId) {
        drawSelectionOutline(ctx, layer);
      }
      continue;
    }

    ctx.save();

    // --- Поворот ---
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    if (layer.isBarcode) {
      // --- Генерация EAN-13 штрихкода ---
      drawBarcodeOnCanvas(
        ctx,
        cellValue,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
        layer.barcodeOptions
      );
    } else {
      // --- Обычный текст ---
      renderTextLayer(ctx, layer, cellValue);
    }

    ctx.restore();

    // Рамка выделения (поверх содержимого)
    if (drawSelection && layer.id === selectedLayerId) {
      ctx.save();
      // Применяем поворот для рамки
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
      drawSelectionOutline(ctx, layer);
      ctx.restore();
    }
  }
}

/**
 * Рендерит текстовый слой на canvas.
 * Использует автоподбор размера шрифта и перенос по словам.
 */
export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  text: string
): void {
  // Автоподбор размера шрифта
  const fittedSize = fitFontSize(
    ctx,
    text,
    layer.width,
    layer.height,
    layer.fontFamily,
    layer.fontStyle,
    layer.fontSize
  );

  const fontStr = buildFontString(layer.fontStyle, fittedSize, layer.fontFamily);
  ctx.font = fontStr;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.textAlign;
  ctx.textBaseline = 'top';

  // Перенос текста с подобранным размером
  const padding = 8;
  const availW = layer.width - 2 * padding;
  const lines = wrapWords(ctx, text, availW);

  const lineHeight = fittedSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  // Вертикальное центрирование
  let startY = layer.y + Math.max(padding, (layer.height - totalTextHeight) / 2);

  // Clip строго по границам слоя
  ctx.save();
  ctx.beginPath();
  ctx.rect(layer.x, layer.y, layer.width, layer.height);
  ctx.clip();

  for (const line of lines) {
    let lineX = layer.x + padding;
    if (layer.textAlign === 'center') {
      lineX = layer.x + layer.width / 2;
    } else if (layer.textAlign === 'right') {
      lineX = layer.x + layer.width - padding;
    }
    ctx.fillText(line, lineX, startY);
    startY += lineHeight;
  }

  ctx.restore();
}

/**
 * Рисует рамку выделения вокруг слоя (для предпросмотра).
 */
export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer
): void {
  ctx.save();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
  ctx.setLineDash([]);

  // Рисуем ручки ресайза
  const handles = getResizeHandlePositions(layer);
  for (const handle of handles) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
    ctx.strokeRect(handle.x - 4, handle.y - 4, 8, 8);
  }

  ctx.restore();
}

/**
 * Возвращает позиции ручек ресайза для слоя.
 */
export function getResizeHandlePositions(layer: TextLayer): Array<{ handle: string; x: number; y: number }> {
  const { x, y, width, height } = layer;
  return [
    { handle: 'nw', x, y },
    { handle: 'n', x: x + width / 2, y },
    { handle: 'ne', x: x + width, y },
    { handle: 'w', x, y: y + height / 2 },
    { handle: 'e', x: x + width, y: y + height / 2 },
    { handle: 'sw', x, y: y + height },
    { handle: 's', x: x + width / 2, y: y + height },
    { handle: 'se', x: x + width, y: y + height },
  ];
}

/**
 * Определяет, какая ручка ресайза находится под курсором.
 */
export function hitTestResizeHandle(
  layer: TextLayer,
  imgX: number,
  imgY: number,
  threshold: number = 8
): string | null {
  const handles = getResizeHandlePositions(layer);
  for (const h of handles) {
    if (Math.abs(imgX - h.x) <= threshold && Math.abs(imgY - h.y) <= threshold) {
      return h.handle;
    }
  }
  return null;
}

/**
 * Определяет, находится ли точка внутри слоя.
 */
export function hitTestLayer(
  layer: TextLayer,
  imgX: number,
  imgY: number
): boolean {
  return (
    imgX >= layer.x &&
    imgX <= layer.x + layer.width &&
    imgY >= layer.y &&
    imgY <= layer.y + layer.height
  );
}

// ============================================================
//   Вспомогательные функции (перенесены из ImageGenerator)
// ============================================================

/** Собирает строку шрифта для Canvas API */
export function buildFontString(fontStyle: string, fontSize: number, fontFamily: string): string {
  let s = '';
  if (fontStyle.includes('italic')) s += 'italic ';
  if (fontStyle.includes('bold')) s += 'bold ';
  s += `${fontSize}px "${fontFamily}"`;
  return s;
}

/**
 * Переносит текст по словам так, чтобы каждая строка не превышала availWidth.
 * Длинные слова разбиваются посимвольно.
 * ctx.font должен быть уже установлен.
 */
export function wrapWords(ctx: CanvasRenderingContext2D, text: string, availWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    // Проверяем, помещается ли слово целиком
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= availWidth) {
      current = candidate;
      continue;
    }

    // Если слово одно и оно шире availWidth — разбиваем посимвольно
    if (!current && ctx.measureText(word).width > availWidth) {
      // Сначала сбрасываем текущую строку если есть
      if (current) {
        lines.push(current);
        current = '';
      }
      // Посимвольный разрыв длинного слова
      let charLine = '';
      for (const ch of word) {
        const testLine = charLine + ch;
        if (ctx.measureText(testLine).width > availWidth && charLine) {
          lines.push(charLine);
          charLine = ch;
        } else {
          charLine = testLine;
        }
      }
      if (charLine) current = charLine;
      continue;
    }

    // Слово не помещается в текущую строку — переносим на новую
    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/**
 * Подбирает максимальный размер шрифта (≤ requestedSize), при котором весь текст
 * вписывается в область layerWidth × layerHeight (с учётом padding).
 * Бинарный поиск вместо линейного — O(log n) вместо O(n).
 */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  layerWidth: number,
  layerHeight: number,
  fontFamily: string,
  fontStyle: string,
  requestedSize: number
): number {
  const MIN_SIZE = 6;
  const padding = 8;
  const availW = layerWidth - 2 * padding;
  const availH = layerHeight - 2 * padding;

  let lo = MIN_SIZE;
  let hi = Math.min(requestedSize, layerHeight);
  let bestSize = MIN_SIZE;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = buildFontString(fontStyle, mid, fontFamily);
    const lines = wrapWords(ctx, text, availW);
    const totalH = lines.length * mid * 1.3;
    const maxW = lines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);

    if (maxW <= availW && totalH <= availH) {
      bestSize = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return bestSize;
}

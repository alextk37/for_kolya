/**
 * Единый Canvas-рендерер для предпросмотра и генерации изображений.
 * Гарантирует WYSIWYG — что видишь в предпросмотре = что получишь при генерации.
 *
 * Отладка: установи localStorage.debugCanvas = 'true' для вывода метрик в консоль.
 */
import type { TextLayer, CsvData } from '../types';
import { drawBarcodeOnCanvas } from './drawBarcode';

/** Включение отладочного режима через localStorage.debugCanvas */
const DEBUG = typeof window !== 'undefined' && localStorage.getItem('debugCanvas') === 'true';

function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[CanvasRenderer]', ...args);
}

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
  /**
   * Цвет фона под изображением.
   * Нужен для форматов без прозрачности (JPEG, WebP) — иначе прозрачные
   * области подложки (PNG/SVG) станут чёрными при экспорте.
   * По умолчанию: undefined (прозрачный).
   */
  backgroundColor?: string;
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
    backgroundColor,
  } = options;

  // Очищаем canvas
  ctx.clearRect(0, 0, width, height);

  // Заливка фона для форматов без прозрачности (JPEG, WebP)
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

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

  // Отладка: выводим метрики при каждом рендере
  debugLog('renderScene:', {
    width,
    height,
    layerCount: layers.length,
    rowIndex,
    drawSelection,
    dpr: window.devicePixelRatio,
  });

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
  // Применяем трансформации текста
  let displayText = text;
  if (layer.textTransform === 'uppercase') {
    displayText = text.toUpperCase();
  } else if (layer.textTransform === 'lowercase') {
    displayText = text.toLowerCase();
  } else if (layer.textTransform === 'capitalize') {
    displayText = text.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Автоподбор размера шрифта
  const fontWeight = layer.fontWeight ?? 400;
  const fittedSize = fitFontSize(
    ctx,
    displayText,
    layer.width,
    layer.height,
    layer.fontFamily,
    layer.fontStyle,
    layer.fontSize,
    layer.lineHeight,
    layer.letterSpacing,
    fontWeight
  );

  const fontStr = buildFontString(layer.fontStyle, fittedSize, layer.fontFamily, fontWeight);
  ctx.font = fontStr;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.textAlign;
  ctx.textBaseline = 'top';

  // Межсловный интервал
  if (layer.wordSpacing && layer.wordSpacing !== 0) {
    // Canvas API не поддерживает wordSpacing напрямую,
    // поэтому учитываем его при переносе слов
  }

  // Прозрачность
  if (layer.opacity !== undefined && layer.opacity !== 1) {
    ctx.globalAlpha = layer.opacity;
  }

  // Тень текста
  if (layer.textShadow) {
    ctx.shadowColor = layer.textShadow.color;
    ctx.shadowBlur = layer.textShadow.blur;
    ctx.shadowOffsetX = layer.textShadow.offsetX;
    ctx.shadowOffsetY = layer.textShadow.offsetY;
  }

  // Перенос текста с подобранным размером
  const padding = 8;
  const availW = layer.width - 2 * padding;
  const lines = wrapWords(ctx, displayText, availW, layer.letterSpacing, layer.wordSpacing);

  const lineHeightVal = fittedSize * (layer.lineHeight || 1.3);
  const totalTextHeight = lines.length * lineHeightVal;

  // Отладка: метрики текстового слоя
  debugLog('renderTextLayer:', {
    layerId: layer.id,
    columnName: layer.columnName,
    text,
    displayText,
    fittedSize,
    requestedSize: layer.fontSize,
    fontWeight,
    lines: lines.length,
    totalTextHeight,
    layerHeight: layer.height,
    availW,
    measureWidths: lines.map((l) => ctx.measureText(l).width),
    dpr: window.devicePixelRatio,
  });

  // Вертикальное выравнивание
  const baseline = layer.textBaseline ?? 'middle';
  let startY: number;
  if (baseline === 'top') {
    startY = Math.round(layer.y + padding);
  } else if (baseline === 'bottom') {
    startY = Math.round(layer.y + layer.height - totalTextHeight - padding);
  } else {
    // middle (по умолчанию)
    startY = Math.round(layer.y + Math.max(padding, (layer.height - totalTextHeight) / 2));
  }

  // Clip строго по границам слоя
  ctx.save();
  ctx.beginPath();
  ctx.rect(layer.x, layer.y, layer.width, layer.height);
  ctx.clip();

  for (const line of lines) {
    let lineX = Math.round(layer.x + padding);
    if (layer.textAlign === 'center') {
      lineX = Math.round(layer.x + layer.width / 2);
    } else if (layer.textAlign === 'right') {
      lineX = Math.round(layer.x + layer.width - padding);
    }
    // Декорация текста (underline / line-through)
    if (layer.textDecoration && layer.textDecoration !== 'none') {
      ctx.save();
      const metrics = ctx.measureText(line);
      let decoX = lineX;
      if (layer.textAlign === 'center') {
        decoX = lineX - metrics.width / 2;
      } else if (layer.textAlign === 'right') {
        decoX = lineX - metrics.width;
      }
      const decoY = layer.textDecoration === 'underline'
        ? startY + fittedSize * 0.85
        : startY + fittedSize * 0.45;
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = Math.max(1, fittedSize / 14);
      ctx.beginPath();
      ctx.moveTo(decoX, decoY);
      ctx.lineTo(decoX + metrics.width, decoY);
      ctx.stroke();
      ctx.restore();
    }

    // letterSpacing или wordSpacing: рисуем посимвольно/пословно
    const hasLetterSpacing = layer.letterSpacing && layer.letterSpacing > 0;
    const hasWordSpacing = layer.wordSpacing && layer.wordSpacing !== 0;

    if (hasLetterSpacing || hasWordSpacing) {
      // Разбиваем строку на слова и символы
      const lineWords = line.split(' ');
      let drawX = lineX;

      // Вычисляем полную ширину для выравнивания
      let totalLineWidth = hasLetterSpacing
        ? measureTextWithSpacing(ctx, line, layer.letterSpacing)
        : ctx.measureText(line).width;
      if (hasWordSpacing) {
        totalLineWidth += (lineWords.length - 1) * (layer.wordSpacing || 0);
      }

      // Пересчёт для center/right
      if (layer.textAlign === 'center') {
        drawX = lineX - totalLineWidth / 2;
      } else if (layer.textAlign === 'right') {
        drawX = lineX - totalLineWidth;
      }

      for (let wi = 0; wi < lineWords.length; wi++) {
        const word = lineWords[wi];
        if (hasLetterSpacing) {
          // Посимвольная отрисовка с letterSpacing
          for (const ch of word) {
            // Обводка
            if (layer.textStroke && layer.textStroke.width > 0) {
              ctx.strokeStyle = layer.textStroke.color;
              ctx.lineWidth = layer.textStroke.width;
              ctx.lineJoin = 'round';
              ctx.strokeText(ch, drawX, startY);
            }
            ctx.fillText(ch, drawX, startY);
            drawX += ctx.measureText(ch).width + layer.letterSpacing;
          }
        } else {
          // Слово целиком
          if (layer.textStroke && layer.textStroke.width > 0) {
            ctx.strokeStyle = layer.textStroke.color;
            ctx.lineWidth = layer.textStroke.width;
            ctx.lineJoin = 'round';
            ctx.strokeText(word, drawX, startY);
          }
          ctx.fillText(word, drawX, startY);
          drawX += ctx.measureText(word).width;
        }
        // Добавляем пробел + wordSpacing
        if (wi < lineWords.length - 1) {
          drawX += ctx.measureText(' ').width + (layer.wordSpacing || 0);
        }
      }
    } else {
      // Обводка текста (stroke)
      if (layer.textStroke && layer.textStroke.width > 0) {
        ctx.strokeStyle = layer.textStroke.color;
        ctx.lineWidth = layer.textStroke.width;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, lineX, startY);
      }
      ctx.fillText(line, lineX, startY);
    }
    startY += lineHeightVal;
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
export function buildFontString(fontStyle: string, fontSize: number, fontFamily: string, fontWeight: number = 400): string {
  let s = '';
  if (fontStyle.includes('italic')) s += 'italic ';
  // Используем числовой вес если он отличается от дефолтного 400
  // или если fontStyle не содержит 'bold' (чтобы не дублировать)
  if (fontStyle.includes('bold') && fontWeight <= 400) {
    s += 'bold ';
  } else if (fontWeight !== 400) {
    s += `${fontWeight} `;
  }
  s += `${fontSize}px "${fontFamily}"`;
  return s;
}

/**
 * Переносит текст по словам так, чтобы каждая строка не превышала availWidth.
 * Длинные слова разбиваются посимвольно.
 * ctx.font должен быть уже установлен.
 */
export function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  availWidth: number,
  letterSpacing: number = 0,
  wordSpacing: number = 0
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  /** Измеряет ширину текста с учётом letterSpacing и wordSpacing */
  const measure = (str: string): number => {
    if (letterSpacing <= 0 && wordSpacing <= 0) {
      return ctx.measureText(str).width;
    }
    // Подсчёт с учётом letterSpacing
    let w = letterSpacing > 0
      ? measureTextWithSpacing(ctx, str, letterSpacing)
      : ctx.measureText(str).width;
    // Добавляем wordSpacing для каждого пробела в строке
    if (wordSpacing > 0) {
      const spaceCount = str.split(' ').length - 1;
      w += spaceCount * wordSpacing;
    }
    return w;
  };

  for (const word of words) {
    // Проверяем, помещается ли слово целиком
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= availWidth) {
      current = candidate;
      continue;
    }

    // Если слово одно и оно шире availWidth — разбиваем посимвольно
    if (!current && measure(word) > availWidth) {
      // Сначала сбрасываем текущую строку если есть
      if (current) {
        lines.push(current);
        current = '';
      }
      // Посимвольный разрыв длинного слова
      let charLine = '';
      for (const ch of word) {
        const testLine = charLine + ch;
        if (measure(testLine) > availWidth && charLine) {
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

/** Измеряет ширину текста с учётом letterSpacing */
function measureTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width;
    if (i < text.length - 1) {
      totalWidth += letterSpacing;
    }
  }
  return totalWidth;
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
  requestedSize: number,
  lineHeightMultiplier: number = 1.3,
  letterSpacing: number = 0,
  fontWeight: number = 400
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
    ctx.font = buildFontString(fontStyle, mid, fontFamily, fontWeight);
    const lines = wrapWords(ctx, text, availW, letterSpacing);
    const totalH = lines.length * mid * lineHeightMultiplier;
    const maxW = lines.reduce((max, l) => {
      if (letterSpacing > 0) {
        return Math.max(max, measureTextWithSpacing(ctx, l, letterSpacing));
      }
      return Math.max(max, ctx.measureText(l).width);
    }, 0);

    if (maxW <= availW && totalH <= availH) {
      bestSize = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return bestSize;
}

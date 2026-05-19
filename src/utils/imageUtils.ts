/**
 * Утилиты для работы с изображениями разных форматов (JPEG, PNG, SVG, WebP, BMP).
 *
 * Решает:
 *  — SVG без явных width/height (naturalWidth = 0)
 *  — Конвертацию SVG-единиц (mm, cm, in, pt, pc) в пиксели
 *  — Ограничение максимального размера изображения
 */

/** Максимальная размерность изображения (пиксели) */
export const MAX_IMAGE_DIMENSION = 8192;

/** Размер по умолчанию для SVG без явных размеров */
export const DEFAULT_SVG_WIDTH = 800;
export const DEFAULT_SVG_HEIGHT = 600;

/**
 * Конвертирует SVG-длину с единицами в пиксели.
 * Поддерживаемые единицы: px, pt, pc, mm, cm, in.
 * Без единиц — считается пикселями.
 */
function convertSvgLengthToPixels(value: string): number {
  const trimmed = value.trim();
  const match = trimmed.match(/^([+-]?\d*\.?\d+)(px|pt|pc|mm|cm|in)?$/);
  if (!match) return parseFloat(trimmed) || 0;

  const num = parseFloat(match[1]);
  const unit = match[2] || 'px';

  switch (unit) {
    case 'px': return num;
    case 'pt': return num * (96 / 72);
    case 'pc': return num * 16;
    case 'mm': return num * (96 / 25.4);
    case 'cm': return num * (96 / 2.54);
    case 'in': return num * 96;
    default: return num;
  }
}

/**
 * Парсит SVG-контент для извлечения размеров из viewBox, width, height.
 * Возвращает {width, height} или null, если размеры не определены.
 */
export function parseSvgDimensions(svgText: string): { width: number; height: number } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    // Сначала пробуем width/height (должны быть в абсолютных единицах, не %)
    const wAttr = svgEl.getAttribute('width');
    const hAttr = svgEl.getAttribute('height');
    if (wAttr && hAttr && !wAttr.includes('%') && !hAttr.includes('%')) {
      const width = convertSvgLengthToPixels(wAttr);
      const height = convertSvgLengthToPixels(hAttr);
      if (width > 0 && height > 0 && isFinite(width) && isFinite(height)) {
        return { width: Math.round(width), height: Math.round(height) };
      }
    }

    // Пробуем viewBox: "minX minY width height"
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (
        parts.length >= 4 &&
        parts[2] > 0 && parts[3] > 0 &&
        isFinite(parts[2]) && isFinite(parts[3])
      ) {
        return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Определяет, является ли файл SVG-изображением.
 */
export function isSvgFile(file: File): boolean {
  if (file.type === 'image/svg+xml') return true;
  // Некоторые браузеры не устанавливают MIME-тип для SVG
  return file.name.toLowerCase().endsWith('.svg');
}

/**
 * Определяет, является ли Blob SVG-изображением.
 */
export function isSvgBlob(blob: Blob): boolean {
  return blob.type === 'image/svg+xml';
}

/**
 * Ограничивает размер изображения максимальной размерностью,
 * сохраняя пропорции. Возвращает {width, height}.
 */
export function clampImageSize(
  width: number,
  height: number,
  maxDim: number = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Асинхронно читает файл как текст.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Асинхронно читает Blob как текст.
 */
export function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * Инжектирует явные width/height в SVG, если они отсутствуют.
 * Это необходимо для корректного рендеринга SVG на canvas через drawImage.
 *
 * Если SVG имеет viewBox, но не имеет width/height — добавляет их
 * на основе viewBox. Если нет и viewBox — использует размеры по умолчанию.
 *
 * Возвращает модифицированный SVG-текст и новые размеры.
 */
function injectSvgDimensions(
  svgText: string,
  fallbackWidth: number,
  fallbackHeight: number
): { svg: string; width: number; height: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return { svg: svgText, width: fallbackWidth, height: fallbackHeight };

    const wAttr = svgEl.getAttribute('width');
    const hAttr = svgEl.getAttribute('height');
    const hasExplicitWidth = wAttr && !wAttr.includes('%');
    const hasExplicitHeight = hAttr && !hAttr.includes('%');

    if (hasExplicitWidth && hasExplicitHeight) {
      // Уже есть размеры — ничего не делаем
      return {
        svg: svgText,
        width: convertSvgLengthToPixels(wAttr!),
        height: convertSvgLengthToPixels(hAttr!),
      };
    }

    // Пробуем взять из viewBox
    const viewBox = svgEl.getAttribute('viewBox');
    let width = fallbackWidth;
    let height = fallbackHeight;

    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
        width = Math.round(parts[2]);
        height = Math.round(parts[3]);
      }
    }

    // Инжектируем width/height в пикселях
    svgEl.setAttribute('width', `${width}px`);
    svgEl.setAttribute('height', `${height}px`);

    // Сериализуем обратно в строку
    const serializer = new XMLSerializer();
    const modifiedSvg = serializer.serializeToString(doc);

    return { svg: modifiedSvg, width, height };
  } catch {
    return { svg: svgText, width: fallbackWidth, height: fallbackHeight };
  }
}

/**
 * Загружает изображение и возвращает корректные размеры.
 * Для SVG без явных width/height — инжектирует размеры в SVG-разметку
 * и создаёт новый blob URL, чтобы drawImage на canvas работал корректно.
 *
 * @param file — файл изображения
 * @param url — blob URL файла (может быть заменён для SVG)
 * @returns { img, width, height, finalUrl } — finalUrl может отличаться от url для SVG
 */
export async function loadImageWithDimensions(
  file: File,
  url: string
): Promise<{ img: HTMLImageElement; width: number; height: number; finalUrl: string }> {
  // Для SVG — сначала парсим и инжектируем размеры
  if (isSvgFile(file)) {
    try {
      const svgText = await readFileAsText(file);
      const { svg: modifiedSvg, width, height } = injectSvgDimensions(svgText, DEFAULT_SVG_WIDTH, DEFAULT_SVG_HEIGHT);
      const clamped = clampImageSize(width, height);

      // Создаём новый blob из модифицированного SVG
      const svgBlob = new Blob([modifiedSvg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = await loadRawImage(svgUrl);
      return { img, width: clamped.width, height: clamped.height, finalUrl: svgUrl };
    } catch {
      // Fallback — пробуем загрузить как есть
    }
  }

  // Для растровых изображений — стандартная загрузка
  const img = await loadRawImage(url);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Fallback для любых изображений с нулевыми размерами
  if (width === 0 || height === 0) {
    width = DEFAULT_SVG_WIDTH;
    height = DEFAULT_SVG_HEIGHT;
  }

  const clamped = clampImageSize(width, height);
  return { img, width: clamped.width, height: clamped.height, finalUrl: url };
}

/**
 * Загружает Image элемент по URL. Не парсит размеры — просто загружает.
 */
function loadRawImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (url.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не удалось загрузить изображение: ${url}`));
    img.src = url;
  });
}

/**
 * Загружает изображение из Blob и возвращает корректные размеры.
 * Версия для загрузки проектов (где есть Blob, но нет File).
 * Для SVG — инжектирует размеры для корректного рендеринга на canvas.
 *
 * @param blob — Blob изображения
 * @param url — blob URL (может быть заменён для SVG)
 * @param fallbackSize — запасные размеры (из сохранённого проекта)
 * @returns { img, width, height, finalUrl } — finalUrl может отличаться для SVG
 */
export async function loadImageFromBlob(
  blob: Blob,
  url: string,
  fallbackSize: { width: number; height: number }
): Promise<{ img: HTMLImageElement; width: number; height: number; finalUrl: string }> {
  // Для SVG — инжектируем размеры
  if (isSvgBlob(blob)) {
    try {
      const svgText = await readBlobAsText(blob);
      const { svg: modifiedSvg, width, height } = injectSvgDimensions(
        svgText,
        fallbackSize.width || DEFAULT_SVG_WIDTH,
        fallbackSize.height || DEFAULT_SVG_HEIGHT
      );
      const clamped = clampImageSize(width, height);

      const svgBlob = new Blob([modifiedSvg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = await loadRawImage(svgUrl);
      return { img, width: clamped.width, height: clamped.height, finalUrl: svgUrl };
    } catch {
      // Fallback — пробуем загрузить как есть
    }
  }

  // Для растровых — стандартная загрузка
  const img = await loadRawImage(url);
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Fallback: используем сохранённые размеры проекта
  if (width === 0 || height === 0) {
    if (fallbackSize.width > 0 && fallbackSize.height > 0) {
      width = fallbackSize.width;
      height = fallbackSize.height;
    } else {
      width = DEFAULT_SVG_WIDTH;
      height = DEFAULT_SVG_HEIGHT;
    }
  }

  const clamped = clampImageSize(width, height);
  return { img, width: clamped.width, height: clamped.height, finalUrl: url };
}

export interface BarcodeOptions {
  /** Высота штрихкода в пикселях */
  height: number;
  /** Ширина минимальной полосы в пикселях */
  width: number;
  /** Показывать ли текст под штрихкодом */
  displayValue: boolean;
  /** Размер шрифта под штрихкодом */
  fontSize: number;
  /** Шрифт текста под штрихкодом */
  fontFamily: string;
  /** Цвет полос */
  lineColor: string;
  /** Цвет фона */
  background: string;
  /** Отступы вокруг штрихкода (общий) */
  margin: number;
  /** Отступ сверху */
  marginTop: number;
  /** Отступ снизу */
  marginBottom: number;
  /** Отступ слева */
  marginLeft: number;
  /** Отступ справа */
  marginRight: number;
  /** Отступ между штрихкодом и текстом */
  textMargin: number;
  /** Выравнивание текста под штрихкодом */
  textAlign: CanvasTextAlign;
}

export interface TextShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextStroke {
  /** Цвет обводки */
  color: string;
  /** Толщина обводки (px) */
  width: number;
}

export interface TextLayer {
  id: string;
  columnIndex: number;
  columnName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: CanvasTextAlign;
  fontStyle: string; // normal, italic
  /** Насыщенность шрифта (100 — Thin, 200 — ExtraLight, ..., 900 — Black) */
  fontWeight: number;
  rotation: number; // degrees, 0-360
  /** Если true — слой отображает EAN-13 штрихкод вместо текста */
  isBarcode: boolean;
  /** Настройки штрихкода (только если isBarcode === true) */
  barcodeOptions: BarcodeOptions;
  /** Видимость слоя (false — скрыт, не рендерится при генерации) */
  visible: boolean;
  /** Блокировка слоя (true — нельзя перемещать/ресайзить) */
  locked: boolean;
  /** Порядок слоя (z-index). Больше значение — выше слой */
  order: number;
  /** Межбуквенный интервал (px) */
  letterSpacing: number;
  /** Межстрочный интервал (множитель, напр. 1.3) */
  lineHeight: number;
  /** Межсловный интервал (px) */
  wordSpacing: number;
  /** Декорация текста */
  textDecoration: 'none' | 'underline' | 'line-through';
  /** Трансформация текста */
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** Прозрачность текста (0-1) */
  opacity: number;
  /** Тень текста */
  textShadow: TextShadow | null;
  /** Обводка текста */
  textStroke: TextStroke | null;
  /** Вертикальное выравнивание текста внутри слоя */
  textBaseline: 'top' | 'middle' | 'bottom';
}

export interface CsvData {
  headers: string[];
  rows: string[][];
}

export interface AppState {
  image: HTMLImageElement | null;
  imageUrl: string | null;
  csvData: CsvData | null;
  layers: TextLayer[];
  selectedLayerId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: string | null;
  dragOffset: { x: number; y: number } | null;
}

/**
 * Метаданные проекта для сохранения/загрузки.
 * Хранится в IndexedDB.
 */
export interface ProjectManifest {
  /** Уникальный ID проекта */
  id: string;
  /** Название, заданное пользователем */
  name: string;
  /** Дата создания (ISO) */
  createdAt: string;
  /** Дата последнего изменения (ISO) */
  updatedAt: string;
  /** Имя файла изображения-шаблона */
  imageFileName: string;
  /** Имя CSV-файла */
  csvFileName: string;
  /** Размер изображения */
  imageSize: { width: number; height: number };
  /** Слои (все настройки позиции, шрифта, штрихкода) */
  layers: TextLayer[];
  /** Данные CSV (нужны для генерации) */
  csvData: CsvData;
}

/**
 * Проект целиком — манифест + бинарные данные (blob'ы).
 * Хранится в IndexedDB.
 */
export interface ProjectRecord extends ProjectManifest {
  /** Blob изображения-шаблона */
  imageBlob: Blob;
}

/** Настройки генерации изображений */
export interface GenerationOptions {
  /** Формат выходных файлов */
  format: 'png' | 'jpeg' | 'webp';
  /** Качество (0-1) для jpeg/webp */
  quality: number;
  /** Начальная строка (0-based) */
  startRow: number;
  /** Конечная строка (0-based, включительно) */
  endRow: number;
  /** Шаблон имени файла, например "{Name}_{index}" */
  fileNameTemplate: string;
}

/** Запись об ошибке при генерации */
export interface GenerationError {
  rowIndex: number;
  message: string;
}

/** Toast-уведомление */
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  duration?: number;
}

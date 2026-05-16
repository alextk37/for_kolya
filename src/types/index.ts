export interface BarcodeOptions {
  /** Высота штрихкода в пикселях */
  height: number;
  /** Ширина минимальной полосы в пикселях */
  width: number;
  /** Показывать ли текст под штрихкодом */
  displayValue: boolean;
  /** Размер шрифта под штрихкодом */
  fontSize: number;
  /** Цвет полос */
  lineColor: string;
  /** Цвет фона */
  background: string;
  /** Отступы вокруг штрихкода */
  margin: number;
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
  fontStyle: string; // normal, bold, italic, bold italic
  rotation: number; // degrees, 0-360
  /** Если true — слой отображает EAN-13 штрихкод вместо текста */
  isBarcode: boolean;
  /** Настройки штрихкода (только если isBarcode === true) */
  barcodeOptions: BarcodeOptions;
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

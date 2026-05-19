import { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import type { TextLayer, CsvData, GenerationError } from '../types';
import { renderScene } from '../utils/canvasRenderer';

interface ImageGeneratorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  layers: TextLayer[];
  csvData: CsvData;
  isGenerating: boolean;
  generatedCount: number;
  onStartGeneration: () => void;
  onGenerationProgress: (count: number) => void;
  onGenerationComplete: () => void;
  /** Открыть модальный предпросмотр конкретной строки */
  onPreviewRow: (index: number) => void;
  /** Ref на загруженное изображение */
  imageRef: React.RefObject<HTMLImageElement | null>;
}

export function ImageGenerator({
  imageWidth,
  imageHeight,
  layers,
  csvData,
  isGenerating,
  generatedCount,
  onStartGeneration,
  onGenerationProgress,
  onGenerationComplete,
  onPreviewRow,
  imageRef,
}: ImageGeneratorProps) {
  const [downloadUrls, setDownloadUrls] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const blobCache = useRef<Blob[]>([]);
  const urlsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [generationErrors, setGenerationErrors] = useState<GenerationError[]>([]);

  // Настройки генерации
  const [genFormat, setGenFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [genQuality, setGenQuality] = useState(0.92);
  const [genStartRow, setGenStartRow] = useState(0);
  const [genEndRow, setGenEndRow] = useState(csvData.rows.length - 1);
  const [genFileNameTemplate, setGenFileNameTemplate] = useState('{index}');

  // Cleanup всех blob URL при размонтировании компонента
  useEffect(() => {
    const currentUrls = urlsRef.current;
    return () => {
      for (const url of currentUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    onGenerationComplete();
  }, [onGenerationComplete]);

  /** Формирует имя файла из шаблона и данных строки */
  const buildFileName = useCallback(
    (row: string[], rowIndex: number, ext: string): string => {
      let name = genFileNameTemplate;
      // Подставляем {index} — номер строки (1-based)
      name = name.replace(/\{index\}/g, String(rowIndex + 1));
      // Подставляем {columnName} — значение из соответствующей колонки
      csvData.headers.forEach((header, i) => {
        const safeHeader = header.replace(/[^a-zA-Zа-яА-Я0-9_]/g, '_');
        const value = (row[i] || '').replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_');
        name = name.replace(new RegExp(`\\{${safeHeader}\\}`, 'g'), value);
      });
      // Убираем лишние подчёркивания
      name = name.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
      if (!name) name = `generated-${rowIndex + 1}`;
      return `${name}.${ext}`;
    },
    [genFileNameTemplate, csvData.headers]
  );

  const generateImages = useCallback(async () => {
    // Отменяем предыдущую генерацию, если она ещё идёт
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    onStartGeneration();
    const urls: string[] = [];
    const blobs: Blob[] = [];
    const errors: GenerationError[] = [];

    // Ожидаем загрузки веб-шрифтов для корректных метрик measureText
    await document.fonts.ready;

    const baseImage = imageRef.current;
    if (!baseImage) {
      onGenerationComplete();
      return;
    }

    const startRow = Math.max(0, genStartRow);
    const endRow = Math.min(csvData.rows.length - 1, genEndRow);
    const visibleLayers = layers.filter((l) => l.visible);
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      // Проверка отмены генерации
      if (abortController.signal.aborted) {
        console.log('Генерация отменена пользователем');
        for (const url of urls) {
          URL.revokeObjectURL(url);
        }
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Не удалось получить 2D контекст canvas');
        }

        // Сбрасываем трансформации контекста перед рендерингом
        ctx.resetTransform();

        // Используем единый рендерер
        renderScene(ctx, {
          width: imageWidth,
          height: imageHeight,
          layers: visibleLayers,
          csvData,
          rowIndex,
          image: baseImage,
          drawSelection: false,
          respectVisibility: true,
        });

        let blob: Blob;
        const mimeType = genFormat === 'jpeg' ? 'image/jpeg' : genFormat === 'webp' ? 'image/webp' : 'image/png';
        const quality = genFormat === 'png' ? undefined : genQuality;

        try {
          blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error('canvas.toBlob() вернул null — возможно tainted canvas'));
              },
              mimeType,
              quality
            );
          });
        } catch (err) {
          // Альтернативный метод: toDataURL → Blob
          console.warn('toBlob failed, trying toDataURL fallback:', err);
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const byteString = atob(dataUrl.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          blob = new Blob([ab], { type: mimeType });
        }

        const url = URL.createObjectURL(blob);
        urls.push(url);
        blobs.push(blob);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ rowIndex, message });
        console.error(`Ошибка генерации строки ${rowIndex + 1}:`, message);
      }

      onGenerationProgress(rowIndex - startRow + 1);
      // Даём браузеру время обновить UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Освобождаем старые blob URL и очищаем кэш перед заменой
    for (const oldUrl of urlsRef.current) {
      URL.revokeObjectURL(oldUrl);
    }
    urlsRef.current = urls;
    blobCache.current = blobs;
    setDownloadUrls(urls);
    setGenerationErrors(errors);
    onGenerationComplete();
    abortRef.current = null;
  }, [
    imageRef, imageWidth, imageHeight, layers, csvData,
    genStartRow, genEndRow, genFormat, genQuality,
    onStartGeneration, onGenerationProgress, onGenerationComplete,
  ]);

  const downloadAllAsZip = useCallback(async () => {
    if (blobCache.current.length === 0) return;

    setIsZipping(true);

    const zip = new JSZip();
    const ext = genFormat === 'jpeg' ? 'jpg' : genFormat;

    for (let i = 0; i < blobCache.current.length; i++) {
      const rowIndex = genStartRow + i;
      const row = csvData.rows[rowIndex];
      const fileName = buildFileName(row, rowIndex, ext);
      zip.file(fileName, blobCache.current[i]);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // В Electron — используем нативный диалог сохранения
    if (window.electronAPI?.isElectron) {
      const arrayBuffer = await zipBlob.arrayBuffer();
      await window.electronAPI.saveFileDialog({
        fileName: 'generated-images.zip',
        data: arrayBuffer,
      });
      setIsZipping(false);
      return;
    }

    // В браузере — скачивание через <a>
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'generated-images.zip';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(zipUrl);
    setIsZipping(false);
  }, [genFormat, genStartRow, csvData, buildFileName]);

  const downloadSingle = useCallback(
    async (url: string, index: number) => {
      const rowIndex = genStartRow + index;
      const row = csvData.rows[rowIndex];
      const ext = genFormat === 'jpeg' ? 'jpg' : genFormat;
      const fileName = buildFileName(row, rowIndex, ext);

      // В Electron — используем нативный диалог сохранения
      if (window.electronAPI?.isElectron) {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          await window.electronAPI.saveFileDialog({
            fileName,
            data: arrayBuffer,
          });
        } catch (err) {
          console.error('[downloadSingle] Ошибка сохранения файла:', err);
        }
        return;
      }

      // В браузере — скачивание через <a>
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [genFormat, genStartRow, csvData, buildFileName]
  );

  const totalToGenerate = Math.max(0, Math.min(csvData.rows.length - 1, genEndRow) - genStartRow + 1);
  const progressPercent = totalToGenerate > 0
    ? Math.round((generatedCount / totalToGenerate) * 100)
    : 0;

  return (
    <div className="image-generator">
      <div className="section-header">
        <span className="section-header__icon">⚡</span>
        <span className="section-header__title">Генерация</span>
      </div>

      <p className="image-generator__info">
        Будет создано <strong>{totalToGenerate}</strong> изображений
        {layers.filter((l) => l.visible).length > 0 && (
          <>
            {' '}с <strong>{layers.filter((l) => l.visible).length}</strong> сло{layers.filter((l) => l.visible).length === 1 ? 'ем' : 'ями'}
          </>
        )}
      </p>

      {/* Настройки генерации */}
      <div className="image-generator__settings">
        <div className="prop-row">
          <div className="prop-group">
            <div className="prop-group__label">
              <span>Формат</span>
            </div>
            <select
              value={genFormat}
              onChange={(e) => setGenFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
            >
              <option value="png">PNG (без потерь)</option>
              <option value="jpeg">JPEG (меньше размер)</option>
              <option value="webp">WebP (лучшее сжатие)</option>
            </select>
          </div>

          {genFormat !== 'png' && (
            <div className="prop-group">
              <div className="prop-group__label">
                <span>Качество</span>
                <span className="prop-group__value">{Math.round(genQuality * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={genQuality}
                onChange={(e) => setGenQuality(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="prop-row">
          <div className="prop-group">
            <div className="prop-group__label">
              <span>От строки</span>
            </div>
            <input
              type="number"
              min={1}
              max={csvData.rows.length}
              value={genStartRow + 1}
              onChange={(e) => setGenStartRow(Math.max(0, parseInt(e.target.value, 10) - 1))}
            />
          </div>

          <div className="prop-group">
            <div className="prop-group__label">
              <span>До строки</span>
            </div>
            <input
              type="number"
              min={1}
              max={csvData.rows.length}
              value={genEndRow + 1}
              onChange={(e) => setGenEndRow(Math.min(csvData.rows.length - 1, parseInt(e.target.value, 10) - 1))}
            />
          </div>
        </div>

        <div className="prop-group">
          <div className="prop-group__label">
            <span>Шаблон имени файла</span>
          </div>
          <input
            type="text"
            value={genFileNameTemplate}
            onChange={(e) => setGenFileNameTemplate(e.target.value)}
            placeholder="{index}"
          />
          <span className="prop-group__hint">
            {'{index}'} — номер строки, {'{Имя_колонки}'} — значение из CSV
          </span>
        </div>
      </div>

      <button
        className="btn btn--primary"
        onClick={generateImages}
        disabled={isGenerating || layers.filter((l) => l.visible).length === 0}
        style={{ width: '100%' }}
      >
        {isGenerating ? (
          <>
            <span className="spinner" />
            Генерация... {generatedCount}/{totalToGenerate}
          </>
        ) : (
          'Сгенерировать все изображения'
        )}
      </button>

      {isGenerating && (
        <div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="progress-text">{progressPercent}%</p>
          <button
            className="btn btn--small btn--ghost"
            onClick={cancelGeneration}
            style={{ width: '100%', marginTop: '8px' }}
          >
            ✕ Отменить генерацию
          </button>
        </div>
      )}

      {downloadUrls.length > 0 && (
        <div className="image-generator__results">
          <div className="image-generator__results-header">
            <span className="image-generator__results-title">
              ✅ Готово ({downloadUrls.length})
            </span>
            <button
              className="image-generator__download-all-btn"
              onClick={downloadAllAsZip}
              disabled={isZipping}
            >
              {isZipping ? (
                <>
                  <span className="spinner" />
                  Архивация...
                </>
              ) : (
                <>
                  ⬇ Скачать всё ZIP
                </>
              )}
            </button>
          </div>

          {generationErrors.length > 0 && (
            <div className="image-generator__errors">
              <span className="image-generator__errors-title">
                ⚠ {generationErrors.length} ошибок при генерации
              </span>
              {generationErrors.slice(0, 5).map((err, i) => (
                <div key={i} className="image-generator__error-item">
                  Строка {err.rowIndex + 1}: {err.message}
                </div>
              ))}
              {generationErrors.length > 5 && (
                <span className="image-generator__errors-more">
                  + ещё {generationErrors.length - 5} ошибок
                </span>
              )}
            </div>
          )}

          <div className="image-generator__previews">
            {downloadUrls.map((url, index) => {
              const rowIndex = genStartRow + index;
              return (
                <div key={index} className="image-generator__preview-item">
                  <img
                    src={url}
                    alt={`Generated ${rowIndex + 1}`}
                    onClick={() => onPreviewRow(rowIndex)}
                    title="Клик для предпросмотра"
                  />
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => downloadSingle(url, index)}
                  >
                    #{rowIndex + 1}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

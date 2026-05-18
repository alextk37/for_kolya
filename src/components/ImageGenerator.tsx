import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import type { TextLayer, CsvData } from '../types';
import { drawBarcodeOnCanvas } from '../utils/drawBarcode';

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
}

export function ImageGenerator({
  imageUrl,
  imageWidth,
  imageHeight,
  layers,
  csvData,
  isGenerating,
  generatedCount,
  onStartGeneration,
  onGenerationProgress,
  onGenerationComplete,
}: ImageGeneratorProps) {
  const [downloadUrls, setDownloadUrls] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const blobCache = useRef<Blob[]>([]);

  const generateImages = useCallback(async () => {
    onStartGeneration();
    const urls: string[] = [];
    const blobs: Blob[] = [];

    const baseImage = await loadImage(imageUrl);

    for (let rowIndex = 0; rowIndex < csvData.rows.length; rowIndex++) {
      const row = csvData.rows[rowIndex];

      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext('2d')!;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(baseImage, 0, 0, imageWidth, imageHeight);

      for (const layer of layers) {
        const cellValue = row[layer.columnIndex];
        if (!cellValue || cellValue.trim() === '') continue;

        ctx.save();

        // --- Поворот ---
        const centerX = layer.x + layer.width / 2;
        const centerY = layer.y + layer.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        if (layer.isBarcode) {
          // --- Генерация EAN-13 штрихкода ---
          // Генерируем штрихкод на отдельном canvas через JsBarcode,
          // затем вставляем на целевой canvas как изображение.
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
          // Автоподбор размера шрифта: уменьшаем, пока текст не впишется в слой
          const fittedSize = fitFontSize(
            ctx,
            cellValue,
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

          // --- Перенос текста с подобранным размером ---
          const padding = 8;
          const availW = layer.width - 2 * padding;
          const lines = wrapWords(ctx, cellValue, availW);

          const lineHeight = fittedSize * 1.3;
          const totalTextHeight = lines.length * lineHeight;
          // Вертикальное центрирование
          let startY = layer.y + Math.max(padding, (layer.height - totalTextHeight) / 2);

          // --- Clip строго по границам слоя ---
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

        ctx.restore();
      }

      let blob: Blob;
      try {
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('canvas.toBlob() вернул null — возможно tainted canvas'));
          }, 'image/png');
        });
      } catch (err) {
        console.error('Ошибка экспорта canvas, пробуем альтернативный метод:', err);
        // Альтернативный метод: toDataURL → Blob
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = 'image/png';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: mimeString });
      }
      const url = URL.createObjectURL(blob);
      urls.push(url);
      blobs.push(blob);

      onGenerationProgress(rowIndex + 1);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    blobCache.current = blobs;
    setDownloadUrls(urls);
    onGenerationComplete();
  }, [imageUrl, imageWidth, imageHeight, layers, csvData, onStartGeneration, onGenerationProgress, onGenerationComplete]);

  const downloadAllAsZip = useCallback(async () => {
    if (blobCache.current.length === 0) return;

    setIsZipping(true);

    const zip = new JSZip();

    for (let i = 0; i < blobCache.current.length; i++) {
      const blob = blobCache.current[i];
      const fileName = `generated-${i + 1}.png`;
      zip.file(fileName, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = 'generated-images.zip';
    a.click();

    URL.revokeObjectURL(zipUrl);
    setIsZipping(false);
  }, []);

  const downloadSingle = useCallback(
    (url: string, index: number) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${index + 1}.png`;
      a.click();
    },
    []
  );

  const progressPercent = csvData.rows.length > 0
    ? Math.round((generatedCount / csvData.rows.length) * 100)
    : 0;

  return (
    <div className="image-generator">
      <div className="section-header">
        <span className="section-header__icon">⚡</span>
        <span className="section-header__title">Генерация</span>
      </div>

      <p className="image-generator__info">
        Будет создано <strong>{csvData.rows.length}</strong> изображений
        {layers.length > 0 && (
          <>
            {' '}с <strong>{layers.length}</strong> сло{layers.length === 1 ? 'ем' : 'ями'}
          </>
        )}
      </p>

      <button
        className="btn btn--primary"
        onClick={generateImages}
        disabled={isGenerating || layers.length === 0}
        style={{ width: '100%' }}
      >
        {isGenerating ? (
          <>
            <span className="spinner" />
            Генерация... {generatedCount}/{csvData.rows.length}
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

          <div className="image-generator__previews">
            {downloadUrls.map((url, index) => (
              <div key={index} className="image-generator__preview-item">
                <img src={url} alt={`Generated ${index + 1}`} />
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => downloadSingle(url, index)}
                >
                  #{index + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Устанавливаем crossOrigin для предотвращения tainted canvas в Яндекс Браузере
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Собирает строку шрифта для Canvas API */
function buildFontString(fontStyle: string, fontSize: number, fontFamily: string): string {
  let s = '';
  if (fontStyle.includes('italic')) s += 'italic ';
  if (fontStyle.includes('bold')) s += 'bold ';
  s += `${fontSize}px "${fontFamily}"`;
  return s;
}

/**
 * Переносит текст по словам так, чтобы каждая строка не превышала availWidth.
 * ctx.font должен быть уже установлен.
 */
function wrapWords(ctx: CanvasRenderingContext2D, text: string, availWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > availWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/**
 * Подбирает максимальный размер шрифта (≤ requestedSize), при котором весь текст
 * вписывается в область layerWidth × layerHeight (с учётом padding).
 * Алгоритм: уменьшаем размер на 1px до тех пор, пока текст не вписывается.
 */
function fitFontSize(
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

  let size = Math.min(requestedSize, layerHeight); // не может быть больше высоты слоя

  while (size >= MIN_SIZE) {
    ctx.font = buildFontString(fontStyle, size, fontFamily);
    const lines = wrapWords(ctx, text, availW);
    const totalH = lines.length * size * 1.3;
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));

    if (maxW <= availW && totalH <= availH) {
      return size;
    }
    size--;
  }

  return MIN_SIZE;
}

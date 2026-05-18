import { useRef, useEffect, useCallback } from 'react';
import type { TextLayer, CsvData } from '../types';
import { renderScene } from '../utils/canvasRenderer';

interface RowPreviewModalProps {
  open: boolean;
  image: HTMLImageElement | null;
  imageWidth: number;
  imageHeight: number;
  layers: TextLayer[];
  csvData: CsvData;
  rowIndex: number;
  onClose: () => void;
  onPrevRow: () => void;
  onNextRow: () => void;
}

export function RowPreviewModal({
  open,
  image,
  imageWidth,
  imageHeight,
  layers,
  csvData,
  rowIndex,
  onClose,
  onPrevRow,
  onNextRow,
}: RowPreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  // Рендерим предпросмотр на Canvas
  useEffect(() => {
    if (!open || !canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Размеры модалки — подгоняем под пропорции изображения
    const maxW = Math.min(800, window.innerWidth - 80);
    const maxH = Math.min(600, window.innerHeight - 200);
    const aspectRatio = imageWidth / imageHeight;

    let displayW = maxW;
    let displayH = displayW / aspectRatio;

    if (displayH > maxH) {
      displayH = maxH;
      displayW = displayH * aspectRatio;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    ctx.scale(dpr, dpr);

    const scaleX = displayW / imageWidth;
    const scaleY = displayH / imageHeight;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    renderScene(ctx, {
      width: imageWidth,
      height: imageHeight,
      layers,
      csvData,
      rowIndex,
      image,
      drawSelection: false,
      respectVisibility: true,
    });

    ctx.restore();
  }, [open, image, imageWidth, imageHeight, layers, csvData, rowIndex]);

  // Escape для закрытия
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrevRow();
      if (e.key === 'ArrowRight') onNextRow();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, onPrevRow, onNextRow]);

  // Блокируем скролл
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `preview-row-${rowIndex + 1}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, [rowIndex]);

  if (!open) return null;

  const row = csvData.rows[rowIndex];
  const totalRows = csvData.rows.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--preview"
        onClick={(e) => e.stopPropagation()}
        ref={nameRef}
      >
        <div className="modal__preview-header">
          <h3 className="modal__title">
            Предпросмотр: строка {rowIndex + 1} из {totalRows}
          </h3>
          <button className="btn btn--ghost btn--small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal__preview-canvas">
          <canvas ref={canvasRef} />
        </div>

        {/* Данные строки */}
        {row && (
          <div className="modal__preview-data">
            {csvData.headers.map((header, i) => (
              <div key={i} className="modal__preview-field">
                <span className="modal__preview-field-name">{header}</span>
                <span className="modal__preview-field-value">{row[i] || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Навигация */}
        <div className="modal__preview-nav">
          <button
            className="btn btn--ghost btn--small"
            onClick={onPrevRow}
            disabled={rowIndex <= 0}
          >
            ← Пред.
          </button>
          <span className="modal__preview-counter">
            {rowIndex + 1} / {totalRows}
          </span>
          <button
            className="btn btn--ghost btn--small"
            onClick={onNextRow}
            disabled={rowIndex >= totalRows - 1}
          >
            След. →
          </button>
          <button className="btn btn--primary btn--small" onClick={handleDownload}>
            💾 Скачать
          </button>
        </div>
      </div>
    </div>
  );
}

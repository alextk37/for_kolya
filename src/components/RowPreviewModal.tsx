import { useRef, useEffect, useCallback, useState } from 'react';
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
  const [showData, setShowData] = useState(true);

  // Рендерим предпросмотр на Canvas
  useEffect(() => {
    if (!open || !canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Размеры модалки — подгоняем под пропорции изображения
    const maxW = Math.min(800, window.innerWidth - 80);
    const maxH = Math.min(600, window.innerHeight - 280);
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

  // Клавиатурные шорткаты
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrevRow(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNextRow(); }
      if (e.key === 'd' || e.key === 'D') setShowData((v) => !v);
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
  const progress = totalRows > 1 ? (rowIndex / (totalRows - 1)) * 100 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--preview"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="modal__preview-header">
          <div className="modal__preview-header-left">
            <h3 className="modal__title">
              Предпросмотр
            </h3>
            <span className="modal__preview-row-badge">
              Строка {rowIndex + 1}
            </span>
          </div>
          <button className="btn btn--ghost btn--small modal__preview-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Прогресс-бар навигации */}
        <div className="modal__preview-progress">
          <div className="modal__preview-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Canvas */}
        <div className="modal__preview-canvas">
          <canvas ref={canvasRef} />
        </div>

        {/* Данные строки */}
        {row && showData && (
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
            className="modal__preview-nav-btn"
            onClick={onPrevRow}
            disabled={rowIndex <= 0}
            title="Предыдущая строка (←)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Пред.</span>
          </button>

          <div className="modal__preview-nav-center">
            <span className="modal__preview-counter">
              <span className="modal__preview-counter-current">{rowIndex + 1}</span>
              <span className="modal__preview-counter-sep">/</span>
              <span className="modal__preview-counter-total">{totalRows}</span>
            </span>
            <button
              className="modal__preview-toggle-data"
              onClick={() => setShowData((v) => !v)}
              title={showData ? 'Скрыть данные (D)' : 'Показать данные (D)'}
            >
              {showData ? '📊' : '📋'}
            </button>
          </div>

          <button
            className="modal__preview-nav-btn"
            onClick={onNextRow}
            disabled={rowIndex >= totalRows - 1}
            title="Следующая строка (→)"
          >
            <span>След.</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="modal__preview-nav-divider" />

          <button className="modal__preview-download-btn" onClick={handleDownload} title="Скачать PNG">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12V13H14V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Скачать</span>
          </button>
        </div>

        {/* Подсказки */}
        <div className="modal__preview-hints">
          <span>← → навигация</span>
          <span>D — данные</span>
          <span>Esc — закрыть</span>
        </div>
      </div>
    </div>
  );
}

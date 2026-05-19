import { useState, useRef, useEffect, useCallback } from 'react';
import type { CsvData } from '../types';

interface PreviewBarProps {
  csvData: CsvData;
  rowIndex: number;
  onChangeRow: (index: number) => void;
  onOpenPreview: () => void;
}

export function PreviewBar({
  csvData,
  rowIndex,
  onChangeRow,
  onOpenPreview,
}: PreviewBarProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [animDir, setAnimDir] = useState<1 | -1 | 0>(0);
  const [animKey, setAnimKey] = useState(0);
  const jumpRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(rowIndex);

  const totalRows = csvData.rows.length;
  const row = csvData.rows[rowIndex];
  const progress = totalRows > 1 ? (rowIndex / (totalRows - 1)) * 100 : 0;

  // Анимация смены строки
  useEffect(() => {
    if (prevIndexRef.current !== rowIndex) {
      setAnimDir(rowIndex > prevIndexRef.current ? 1 : -1);
      setAnimKey((k) => k + 1);
      prevIndexRef.current = rowIndex;
    }
  }, [rowIndex]);

  // Фокус на поле ввода при показе
  useEffect(() => {
    if (showJump && jumpRef.current) {
      jumpRef.current.focus();
      jumpRef.current.select();
    }
  }, [showJump]);

  // Закрытие jump по Escape
  useEffect(() => {
    if (!showJump) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowJump(false);
        setJumpInput('');
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [showJump]);

  const handleJump = useCallback(() => {
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalRows) {
      onChangeRow(num - 1);
      setShowJump(false);
      setJumpInput('');
    }
  }, [jumpInput, totalRows, onChangeRow]);

  const handleJumpKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleJump();
      }
    },
    [handleJump]
  );

  const handlePrev = useCallback(() => {
    if (rowIndex > 0) onChangeRow(rowIndex - 1);
  }, [rowIndex, onChangeRow]);

  const handleNext = useCallback(() => {
    if (rowIndex < totalRows - 1) onChangeRow(rowIndex + 1);
  }, [rowIndex, totalRows, onChangeRow]);

  // Прокрутка колёсиком
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY < 0 && rowIndex > 0) {
        onChangeRow(rowIndex - 1);
      } else if (e.deltaY > 0 && rowIndex < totalRows - 1) {
        onChangeRow(rowIndex + 1);
      }
    },
    [rowIndex, totalRows, onChangeRow]
  );

  const handleClose = useCallback(() => {
    setVisible(false);
    setExpanded(false);
    setShowJump(false);
  }, []);

  // Свёрнутая иконка
  if (!visible) {
    return (
      <button
        className="preview-bar__fab"
        onClick={() => setVisible(true)}
        title="Навигация по CSV строкам"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 9C2 9 3.5 4 9 4C14.5 4 16 9 16 9C16 9 14.5 14 9 14C3.5 14 2 9 2 9Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="preview-bar__fab-badge">{rowIndex + 1}</span>
      </button>
    );
  }

  return (
    <div
      className={`preview-bar ${expanded ? 'preview-bar--expanded' : ''} preview-bar--visible`}
      ref={barRef}
      onWheel={handleWheel}
    >
      {/* Прогресс-бар сверху */}
      <div className="preview-bar__progress">
        <div
          className="preview-bar__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Основная строка */}
      <div className="preview-bar__main">
        {/* Навигация */}
        <div className="preview-bar__nav">
          <button
            className="preview-bar__nav-btn"
            onClick={handlePrev}
            disabled={rowIndex <= 0}
            title="Предыдущая строка (←)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Счётчик / Jump */}
          {showJump ? (
            <div className="preview-bar__jump">
              <input
                ref={jumpRef}
                className="preview-bar__jump-input"
                type="number"
                min={1}
                max={totalRows}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                onBlur={() => {
                  setShowJump(false);
                  setJumpInput('');
                }}
                placeholder={`${rowIndex + 1}`}
              />
              <span className="preview-bar__jump-sep">/</span>
              <span className="preview-bar__jump-total">{totalRows}</span>
            </div>
          ) : (
            <button
              className="preview-bar__counter"
              onClick={() => {
                setJumpInput(String(rowIndex + 1));
                setShowJump(true);
              }}
              title="Нажмите для перехода к строке"
            >
              <span
                key={animKey}
                className={`preview-bar__counter-current preview-bar__counter-current--${animDir > 0 ? 'next' : animDir < 0 ? 'prev' : 'idle'}`}
              >
                {rowIndex + 1}
              </span>
              <span className="preview-bar__counter-sep">/</span>
              <span className="preview-bar__counter-total">{totalRows}</span>
            </button>
          )}

          <button
            className="preview-bar__nav-btn"
            onClick={handleNext}
            disabled={rowIndex >= totalRows - 1}
            title="Следующая строка (→)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3L9 7L5 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Данные строки — компактные чипы */}
        <div className="preview-bar__data">
          {csvData.headers.slice(0, expanded ? undefined : 3).map((header, i) => {
            const value = row?.[i] || '—';
            return (
              <div key={i} className="preview-bar__chip">
                <span className="preview-bar__chip-label">{header}</span>
                <span className="preview-bar__chip-value">{value}</span>
              </div>
            );
          })}
          {!expanded && csvData.headers.length > 3 && (
            <button
              className="preview-bar__chip preview-bar__chip--more"
              onClick={() => setExpanded(true)}
              title="Показать все поля"
            >
              <span className="preview-bar__chip-value">+{csvData.headers.length - 3}</span>
            </button>
          )}
        </div>

        {/* Действия */}
        <div className="preview-bar__actions">
          <button
            className="preview-bar__expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Свернуть' : 'Развернуть'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="preview-bar__preview-btn"
            onClick={onOpenPreview}
            title="Полный предпросмотр (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8C2 8 3.5 3.5 8 3.5C12.5 3.5 14 8 14 8C14 8 12.5 12.5 8 12.5C3.5 12.5 2 8 2 8Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            className="preview-bar__close-btn"
            onClick={handleClose}
            title="Свернуть панель"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Расширенная панель данных */}
      {expanded && (
        <div className="preview-bar__expanded">
          <div className="preview-bar__expanded-grid">
            {csvData.headers.map((header, i) => {
              const value = row?.[i] || '—';
              return (
                <div key={i} className="preview-bar__field">
                  <span className="preview-bar__field-label">{header}</span>
                  <span className="preview-bar__field-value">{value}</span>
                </div>
              );
            })}
          </div>
          <button
            className="preview-bar__collapse-btn"
            onClick={() => setExpanded(false)}
          >
            Свернуть
          </button>
        </div>
      )}

      {/* Мини-карта строк */}
      <div className="preview-bar__minimap">
        {Array.from({ length: Math.min(totalRows, 60) }, (_, i) => {
          const realIndex = Math.round((i / (Math.min(totalRows, 60) - 1)) * (totalRows - 1));
          const isActive = realIndex === rowIndex;
          const isNear = Math.abs(realIndex - rowIndex) <= 1;
          return (
            <div
              key={i}
              className={`preview-bar__minimap-dot ${
                isActive
                  ? 'preview-bar__minimap-dot--active'
                  : isNear
                  ? 'preview-bar__minimap-dot--near'
                  : ''
              }`}
              onClick={() => onChangeRow(realIndex)}
              title={`Строка ${realIndex + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

import type { TextLayer, CsvData } from '../types';

interface LayerPanelProps {
  layers: TextLayer[];
  csvData: CsvData | null;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  imageSize: { width: number; height: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function LayerPanel({
  layers,
  csvData,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onToggleVisibility,
  onToggleLock,
  onMoveUp,
  onMoveDown,
  imageSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: LayerPanelProps) {
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  // Сортируем слои по order для отображения
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  // Динамические max для слайдеров позиции
  const maxX = imageSize?.width || 2000;
  const maxY = imageSize?.height || 2000;

  return (
    <div className="layer-panel">
      <div className="section-header">
        <span className="section-header__icon">🎨</span>
        <span className="section-header__title">Слои</span>
        <span className="section-header__badge">{layers.length}</span>
      </div>

      {/* Undo/Redo */}
      <div className="layer-panel__undo-row">
        <button
          className="btn btn--ghost btn--small"
          onClick={onUndo}
          disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
        >
          ↩ Отменить
        </button>
        <button
          className="btn btn--ghost btn--small"
          onClick={onRedo}
          disabled={!canRedo}
          title="Повторить (Ctrl+Shift+Z)"
        >
          ↪ Повторить
        </button>
      </div>

      <div className="layer-list">
        {sortedLayers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-item ${layer.id === selectedLayerId ? 'layer-item--selected' : ''} ${!layer.visible ? 'layer-item--hidden' : ''} ${layer.locked ? 'layer-item--locked' : ''}`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <button
              className="layer-item__visibility-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(layer.id);
              }}
              title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
            >
              {layer.visible ? '👁' : '👁‍🗨'}
            </button>

            <span
              className="layer-item__color-dot"
              style={{ backgroundColor: layer.isBarcode ? '#d4af37' : layer.color }}
            />
            <span className="layer-item__name">
              {layer.isBarcode ? '📶 ' : ''}{layer.columnName}
            </span>

            {layer.locked && <span className="layer-item__lock-icon" title="Заблокирован">🔒</span>}

            <span className="layer-item__index">#{layer.columnIndex + 1}</span>

            <div className="layer-item__actions">
              <button
                className="layer-item__action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp(layer.id);
                }}
                title="Выше"
                disabled={layer.order === 0}
              >
                ▲
              </button>
              <button
                className="layer-item__action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown(layer.id);
                }}
                title="Ниже"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedLayer && (
        <div className="layer-properties">
          <div className="layer-properties__header">
            <span className="layer-properties__title">
              {selectedLayer.isBarcode ? '📶 ' : ''}{selectedLayer.columnName}
            </span>
            <span className="prop-group__value">
              {Math.round(selectedLayer.x)}×{Math.round(selectedLayer.y)}
            </span>
          </div>

          {/* Действия со слоем */}
          <div className="layer-properties__actions">
            <button
              className="btn btn--ghost btn--small"
              onClick={() => onToggleLock(selectedLayer.id)}
              title={selectedLayer.locked ? 'Разблокировать' : 'Заблокировать'}
            >
              {selectedLayer.locked ? '🔓 Разблокировать' : '🔒 Блокировать'}
            </button>
            <button
              className="btn btn--ghost btn--small"
              onClick={() => onDuplicateLayer(selectedLayer.id)}
              title="Дублировать слой (Ctrl+D)"
            >
              📋 Дублировать
            </button>
            <button
              className="btn btn--danger btn--small"
              onClick={() => onDeleteLayer(selectedLayer.id)}
              title="Удалить слой (Delete)"
            >
              🗑 Удалить
            </button>
          </div>

          <div className="prop-group">
            <div className="prop-group__label">
              <span>Позиция X</span>
              <span className="prop-group__value">{Math.round(selectedLayer.x)}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={maxX}
              value={selectedLayer.x}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { x: parseInt(e.target.value, 10) })}
            />
          </div>

          <div className="prop-group">
            <div className="prop-group__label">
              <span>Позиция Y</span>
              <span className="prop-group__value">{Math.round(selectedLayer.y)}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={maxY}
              value={selectedLayer.y}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { y: parseInt(e.target.value, 10) })}
            />
          </div>

          {/* Числовой ввод для точного позиционирования */}
          <div className="prop-row">
            <div className="prop-group">
              <div className="prop-group__label">
                <span>X (точно)</span>
              </div>
              <input
                type="number"
                min={0}
                max={maxX}
                value={Math.round(selectedLayer.x)}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, { x: parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>

            <div className="prop-group">
              <div className="prop-group__label">
                <span>Y (точно)</span>
              </div>
              <input
                type="number"
                min={0}
                max={maxY}
                value={Math.round(selectedLayer.y)}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, { y: parseInt(e.target.value, 10) || 0 })
                }
              />
            </div>
          </div>

          <div className="prop-row">
            <div className="prop-group">
              <div className="prop-group__label">
                <span>Ширина</span>
              </div>
              <input
                type="number"
                min={50}
                max={maxX}
                value={Math.round(selectedLayer.width)}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, { width: parseInt(e.target.value, 10) || 50 })
                }
              />
            </div>

            <div className="prop-group">
              <div className="prop-group__label">
                <span>Высота</span>
              </div>
              <input
                type="number"
                min={20}
                max={maxY}
                value={Math.round(selectedLayer.height)}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, { height: parseInt(e.target.value, 10) || 20 })
                }
              />
            </div>
          </div>

          {selectedLayer.isBarcode ? (
            <>
              <div className="prop-row">
                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Ширина полосы</span>
                  </div>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.1}
                    value={selectedLayer.barcodeOptions.width}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          width: parseFloat(e.target.value) || 1,
                        },
                      })
                    }
                  />
                </div>

                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Высота штрихкода</span>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={selectedLayer.barcodeOptions.height}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          height: parseInt(e.target.value, 10) || 40,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="prop-row">
                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Цвет полос</span>
                  </div>
                  <input
                    type="color"
                    value={selectedLayer.barcodeOptions.lineColor}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          lineColor: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Фон</span>
                  </div>
                  <input
                    type="color"
                    value={selectedLayer.barcodeOptions.background}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          background: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="prop-row">
                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Размер текста</span>
                  </div>
                  <input
                    type="number"
                    min={6}
                    max={48}
                    value={selectedLayer.barcodeOptions.fontSize}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          fontSize: parseInt(e.target.value, 10) || 12,
                        },
                      })
                    }
                  />
                </div>

                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Отступ</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={selectedLayer.barcodeOptions.margin}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          margin: parseInt(e.target.value, 10) || 4,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="prop-group">
                <label className="prop-group__label" style={{ cursor: 'pointer', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedLayer.barcodeOptions.displayValue}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        barcodeOptions: {
                          ...selectedLayer.barcodeOptions,
                          displayValue: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Показывать текст под штрихкодом</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="prop-row">
                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Размер шрифта</span>
                  </div>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={selectedLayer.fontSize}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, { fontSize: parseInt(e.target.value, 10) || 16 })
                    }
                  />
                </div>

                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Цвет</span>
                  </div>
                  <input
                    type="color"
                    value={selectedLayer.color}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { color: e.target.value })}
                  />
                </div>
              </div>

              <div className="prop-group">
                <div className="prop-group__label">
                  <span>Шрифт</span>
                </div>
                <select
                  value={selectedLayer.fontFamily}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                >
                  <optgroup label="── Современные sans-serif ──">
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Lato">Lato</option>
                    <option value="Nunito">Nunito</option>
                    <option value="Ubuntu">Ubuntu</option>
                    <option value="Exo 2">Exo 2</option>
                    <option value="Raleway">Raleway</option>
                  </optgroup>
                  <optgroup label="── Заголовочные / Display ──">
                    <option value="Oswald">Oswald</option>
                    <option value="Bebas Neue">Bebas Neue</option>
                    <option value="Impact">Impact</option>
                  </optgroup>
                  <optgroup label="── Декоративные ──">
                    <option value="Pacifico">Pacifico</option>
                    <option value="Lobster">Lobster</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </optgroup>
                  <optgroup label="── Serif ──">
                    <option value="PT Serif">PT Serif</option>
                    <option value="Merriweather">Merriweather</option>
                    <option value="Lora">Lora</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </optgroup>
                  <optgroup label="── Системные sans-serif ──">
                    <option value="PT Sans">PT Sans</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                  </optgroup>
                  <optgroup label="── Моноширинные ──">
                    <option value="Courier New">Courier New</option>
                  </optgroup>
                </select>
              </div>

              <div className="prop-row">
                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Выравнивание</span>
                  </div>
                  <select
                    value={selectedLayer.textAlign}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        textAlign: e.target.value as CanvasTextAlign,
                      })
                    }
                  >
                    <option value="left">По левому краю</option>
                    <option value="center">По центру</option>
                    <option value="right">По правому краю</option>
                  </select>
                </div>

                <div className="prop-group">
                  <div className="prop-group__label">
                    <span>Стиль</span>
                  </div>
                  <select
                    value={selectedLayer.fontStyle}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { fontStyle: e.target.value })}
                  >
                    <option value="normal">Обычный</option>
                    <option value="bold">Жирный</option>
                    <option value="italic">Курсив</option>
                    <option value="bold italic">Жирный курсив</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="prop-group">
            <div className="prop-group__label">
              <span>Поворот</span>
              <span className="prop-group__value">{Math.round(selectedLayer.rotation)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={selectedLayer.rotation}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, { rotation: parseInt(e.target.value, 10) })
              }
            />
          </div>
        </div>
      )}

      {csvData && (
        <div className="csv-preview">
          <div className="section-header">
            <span className="section-header__icon">📊</span>
            <span className="section-header__title">Данные CSV</span>
            <span className="section-header__badge">{csvData.rows.length} строк</span>
          </div>

          <div className="csv-preview__table">
            <div className="csv-preview__row csv-preview__row--header">
              {csvData.headers.map((h, i) => (
                <span key={i} className="csv-preview__cell">
                  {h}
                </span>
              ))}
            </div>
            {csvData.rows.slice(0, 5).map((row, ri) => (
              <div key={ri} className="csv-preview__row">
                {row.map((cell, ci) => (
                  <span key={ci} className="csv-preview__cell">
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {csvData.rows.length > 5 && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              + ещё {csvData.rows.length - 5} строк
            </p>
          )}
        </div>
      )}
    </div>
  );
}

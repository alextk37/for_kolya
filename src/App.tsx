import { useState, useCallback, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import { useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { FileUploader } from './components/FileUploader';
import { CanvasEditor } from './components/CanvasEditor';
import { LayerPanel } from './components/LayerPanel';
import { ImageGenerator } from './components/ImageGenerator';
import { ProjectSelector } from './components/ProjectSelector';
import { SaveProjectModalWrapper } from './components/SaveProjectModal';
import { RowPreviewModal } from './components/RowPreviewModal';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  loadProject,
  saveProject,
  generateProjectId,
  resetRootHandle,
} from './utils/projectStorage';
import type { SaveProjectData } from './components/SaveProjectModal';
import type { ProjectRecord } from './types';

type Screen = 'selector' | 'editor';

function App() {
  const state = useAppState();
  const toast = useToast();
  const { isDark, toggleTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>('selector');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRowPreview, setShowRowPreview] = useState(false);
  const [rowPreviewIndex, setRowPreviewIndex] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const hasImage = state.imageUrl !== null && state.imageSize !== null;
  const hasCsv = state.csvData !== null;

  // --- Клавиатурные сокращения ---
  useEffect(() => {
    if (screen !== 'editor') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (state.canUndo()) state.undo();
      }
      // Ctrl+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (state.canRedo()) state.redo();
      }
      // Ctrl+S — сохранить
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasImage && hasCsv) setShowSaveModal(true);
      }
      // Delete — удалить выбранный слой
      if (e.key === 'Delete' && state.selectedLayerId) {
        state.deleteLayer(state.selectedLayerId);
      }
      // Ctrl+D — дублировать слой
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && state.selectedLayerId) {
        e.preventDefault();
        state.duplicateLayer(state.selectedLayerId);
      }
      // Escape — снять выделение
      if (e.key === 'Escape') {
        state.selectLayer(null);
      }
      // Стрелки — сдвинуть слой
      if (state.selectedLayerId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const layer = state.layers.find((l) => l.id === state.selectedLayerId);
        if (!layer || layer.locked) return;
        const updates: Record<string, number> = {};
        if (e.key === 'ArrowUp') updates.y = layer.y - step;
        if (e.key === 'ArrowDown') updates.y = layer.y + step;
        if (e.key === 'ArrowLeft') updates.x = layer.x - step;
        if (e.key === 'ArrowRight') updates.x = layer.x + step;
        state.updateLayer(state.selectedLayerId, updates);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, state, hasImage, hasCsv]);

  // --- Предупреждение о несохранённых изменениях ---
  useEffect(() => {
    if (!state.isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  // Загрузка проекта
  const handleSelectProject = useCallback(
    async (id: string) => {
      try {
        const record = await loadProject(id);
        if (!record) return;

        const imageUrl = URL.createObjectURL(record.imageBlob);
        const img = new Image();
        if (imageUrl.startsWith('http')) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
          state.loadFromProject(
            imageUrl,
            record.imageSize,
            record.csvData,
            record.layers,
            img
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          console.error('Failed to load project image');
        };
        img.src = imageUrl;

        setCurrentProjectId(record.id);
        setProjectName(record.name);
        setImageFileName(record.imageFileName);
        setCsvFileName(record.csvFileName);
        setScreen('editor');
        toast.success('Проект загружен');
      } catch (err) {
        console.error('Failed to load project:', err);
        toast.error('Не удалось загрузить проект');
      }
    },
    [state, toast]
  );

  // Новый проект
  const handleCreateNew = useCallback(() => {
    setCurrentProjectId(null);
    setProjectName('');
    setImageFileName('');
    setCsvFileName('');
    state.resetAll();
    setScreen('editor');
  }, [state]);

  // Сохранение проекта
  const doSaveProject = useCallback(
    async (saveData: SaveProjectData) => {
      if (!state.imageUrl || !state.imageSize || !state.csvData) return;
      setProjectName(saveData.name);
      setShowSaveModal(false);

      setSaving(true);
      try {
        const response = await fetch(state.imageUrl);
        const imageBlob = await response.blob();

        const id = currentProjectId || generateProjectId();
        const now = new Date().toISOString();

        let createdAt = now;
        if (currentProjectId) {
          try {
            const existing = await loadProject(id);
            if (existing) createdAt = existing.createdAt;
          } catch {
            // Не удалось загрузить — используем now
          }
        }

        const record: ProjectRecord = {
          id,
          name: saveData.name,
          createdAt,
          updatedAt: now,
          imageFileName: imageFileName || 'image.png',
          csvFileName: csvFileName || 'data.csv',
          imageSize: state.imageSize,
          layers: state.layers,
          csvData: state.csvData,
          imageBlob,
        };

        await saveProject(record, {
          folderHandle: saveData.folderHandle,
          imageFormat: saveData.imageFormat,
        });

        setCurrentProjectId(id);
        state.markSaved();
        toast.success('Проект сохранён ✓');
      } catch (err) {
        console.error('Failed to save project:', err);
        toast.error('Ошибка сохранения проекта');
      } finally {
        setSaving(false);
      }
    },
    [
      state.imageUrl,
      state.imageSize,
      state.csvData,
      state.layers,
      currentProjectId,
      imageFileName,
      csvFileName,
      state,
      toast,
    ]
  );

  const handleSaveProject = useCallback(() => {
    if (!state.imageUrl || !state.imageSize || !state.csvData) return;
    setShowSaveModal(true);
  }, [state.imageUrl, state.imageSize, state.csvData]);

  const handleImageLoad = useCallback(
    (file: File) => {
      setImageFileName(file.name);
      state.handleImageLoad(file);
      toast.info('Изображение загружено');
    },
    [state, toast]
  );

  const handleCsvLoad = useCallback(
    async (file: File) => {
      setCsvFileName(file.name);
      await state.handleCsvLoad(file);
      toast.info('CSV файл загружен');
    },
    [state, toast]
  );

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const doReset = useCallback(() => {
    setImageFileName('');
    setCsvFileName('');
    state.resetAll();
    setShowResetConfirm(false);
    toast.info('Проект сброшен');
  }, [state, toast]);

  const handleChangeFolder = useCallback(async () => {
    await resetRootHandle();
    toast.info('Папка сброшена. Выберите новую при следующем сохранении.');
  }, [toast]);

  // Навигация по строкам в предпросмотре
  const handlePrevRow = useCallback(() => {
    if (!state.csvData) return;
    setRowPreviewIndex((prev) => Math.max(0, prev - 1));
  }, [state.csvData]);

  const handleNextRow = useCallback(() => {
    if (!state.csvData) return;
    setRowPreviewIndex((prev) => Math.min(state.csvData!.rows.length - 1, prev + 1));
  }, [state.csvData]);

  // Показываем ProjectSelector при старте
  if (screen === 'selector') {
    return (
      <div className="app">
        <ErrorBoundary>
          <ProjectSelector
            onSelectProject={handleSelectProject}
            onCreateNew={handleCreateNew}
          />
          <button
            className="btn--theme btn--theme--floating"
            onClick={toggleTheme}
            title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </ErrorBoundary>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      </div>
    );
  }

  return (
    <div className="app">
      <ErrorBoundary>
        <header className="app-header">
          <div className="app-header__brand">
            <div className="app-header__logo" title="Для Коли — редактор изображений">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#d4af37" />
                    <stop offset="50%" stopColor="#f0d060" />
                    <stop offset="100%" stopColor="#d4af37" />
                  </linearGradient>
                  <linearGradient id="logoInner" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f0d060" />
                    <stop offset="100%" stopColor="#b8962e" />
                  </linearGradient>
                </defs>
                {/* Фон — холст */}
                <rect x="3" y="3" width="34" height="34" rx="6" fill="url(#logoGrad)" opacity="0.12" />
                <rect x="5" y="5" width="30" height="30" rx="4" stroke="url(#logoGrad)" strokeWidth="1.2" fill="none" opacity="0.5" />
                {/* Уголки кадрирования */}
                <path d="M8 11V8h3" stroke="url(#logoInner)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M32 11V8h-3" stroke="url(#logoInner)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 29v3h3" stroke="url(#logoInner)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M32 29v3h-3" stroke="url(#logoInner)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Слои — стопка прямоугольников */}
                <rect x="12" y="14" width="16" height="12" rx="2" fill="url(#logoInner)" opacity="0.25" />
                <rect x="14" y="12" width="14" height="10" rx="1.5" fill="url(#logoInner)" opacity="0.4" />
                <rect x="13" y="16" width="14" height="10" rx="1.5" fill="url(#logoInner)" opacity="0.7" />
                {/* Текстовая строка на слое */}
                <line x1="16" y1="21" x2="24" y2="21" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                {/* Карандаш — инструмент редактирования */}
                <g transform="translate(26, 10) rotate(45)">
                  <rect x="0" y="-1.5" width="10" height="3" rx="1" fill="url(#logoInner)" />
                  <polygon points="0,-1.5 -2,0 0,1.5" fill="#f0d060" />
                </g>
                {/* Анимированная точка-индикатор */}
                <circle cx="34" cy="6" r="2.5" fill="#f0d060" opacity="0.8">
                  <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
            <h1>Для Коли</h1>
          </div>

          <div className={`app-header__divider ${state.isDirty ? 'app-header__divider--active' : ''}`} />

          <p className="app-header__subtitle">
            {projectName || 'Новый проект'}
            {state.isDirty && (
              <span className="app-header__dirty-badge">
                <span className="app-header__dirty-dot" title="Есть несохранённые изменения">●</span>
                не сохранено
              </span>
            )}
          </p>

          <div className="app-header__actions">
            <button
              className="btn--back"
              onClick={() => {
                if (state.isDirty) {
                  if (!window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
                }
                setScreen('selector');
              }}
              title="К списку проектов"
            >
              ← Проекты
            </button>

            {hasImage && (
              <>
                <div className="app-header__actions-divider" />
                <button
                  className="btn--save"
                  onClick={handleSaveProject}
                  disabled={saving || !hasCsv}
                >
                  {saving ? '⏳' : '💾'} {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button className="btn--reset" onClick={handleReset} title="Сбросить проект">
                  🔄 Сбросить
                </button>
              </>
            )}

            <div className="app-header__actions-divider" />

            <button
              className="btn--theme"
              onClick={toggleTheme}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              className="btn--folder"
              onClick={handleChangeFolder}
              title="Сменить папку для проектов"
            >
              📁
            </button>
          </div>
        </header>

        {!hasImage ? (
          <main className="app-main app-main--centered">
            <div className="empty-state">
              <div className="empty-state__emblem">ДК</div>
              <h2 className="empty-state__title">Для Коли</h2>
              <p className="empty-state__text">
                Генератор изображений с подстановкой текста из CSV данных
              </p>
              <div className="empty-state__steps">
                <div className="empty-state__step">
                  <span className="empty-state__step-number">1</span>
                  <span>Загрузи шаблон изображения</span>
                </div>
                <div className="empty-state__step">
                  <span className="empty-state__step-number">2</span>
                  <span>Загрузи CSV файл с данными</span>
                </div>
                <div className="empty-state__step">
                  <span className="empty-state__step-number">3</span>
                  <span>Настрой положение и стиль текстовых слоёв</span>
                </div>
                <div className="empty-state__step">
                  <span className="empty-state__step-number">4</span>
                  <span>Сгенерируй изображения для всех строк CSV</span>
                </div>
              </div>
              <FileUploader
                onImageLoad={handleImageLoad}
                onCsvLoad={handleCsvLoad}
                hasImage={hasImage}
                hasCsv={hasCsv}
                imageName={imageFileName}
                csvName={csvFileName}
              />
            </div>
          </main>
        ) : (
          <main className="app-main">
            <div className="app-layout">
              <div className="app-layout__sidebar">
                {!hasCsv && (
                  <FileUploader
                    onImageLoad={handleImageLoad}
                    onCsvLoad={handleCsvLoad}
                    hasImage={hasImage}
                    hasCsv={hasCsv}
                    imageName={imageFileName}
                    csvName={csvFileName}
                  />
                )}

                {hasCsv && state.csvData && (
                  <>
                    <LayerPanel
                      layers={state.layers}
                      csvData={state.csvData}
                      selectedLayerId={state.selectedLayerId}
                      onSelectLayer={state.selectLayer}
                      onUpdateLayer={state.updateLayer}
                      onDeleteLayer={state.deleteLayer}
                      onDuplicateLayer={state.duplicateLayer}
                      onToggleVisibility={state.toggleLayerVisibility}
                      onToggleLock={state.toggleLayerLock}
                      onMoveUp={state.moveLayerUp}
                      onMoveDown={state.moveLayerDown}
                      imageSize={state.imageSize}
                      canUndo={state.canUndo()}
                      canRedo={state.canRedo()}
                      onUndo={state.undo}
                      onRedo={state.redo}
                    />
                    <ImageGenerator
                      imageUrl={state.imageUrl!}
                      imageWidth={state.imageSize!.width}
                      imageHeight={state.imageSize!.height}
                      layers={state.layers}
                      csvData={state.csvData}
                      isGenerating={state.isGenerating}
                      generatedCount={state.generatedCount}
                      onStartGeneration={() => state.setIsGenerating(true)}
                      onGenerationProgress={state.setGeneratedCount}
                      onGenerationComplete={() => state.setIsGenerating(false)}
                      onPreviewRow={(index) => {
                        setRowPreviewIndex(index);
                        setShowRowPreview(true);
                      }}
                      imageRef={state.imageRef}
                    />
                  </>
                )}
              </div>

              <div className="app-layout__canvas">
                {hasImage && state.imageSize && state.csvData && (
                  <CanvasEditor
                    imageUrl={state.imageUrl!}
                    imageWidth={state.imageSize.width}
                    imageHeight={state.imageSize.height}
                    layers={state.layers}
                    selectedLayerId={state.selectedLayerId}
                    isDragging={state.isDragging}
                    isResizing={state.isResizing}
                    csvData={state.csvData}
                    previewRowIndex={state.previewRowIndex}
                    onSelectLayer={state.selectLayer}
                    onStartDrag={state.startDrag}
                    onDoDrag={state.doDrag}
                    onEndDrag={state.endDrag}
                    onStartResize={state.startResize}
                    onDoResize={state.doResize}
                    onEndResize={state.endResize}
                  />
                )}
              </div>
            </div>
          </main>
        )}

        {/* Модалка сохранения */}
        <SaveProjectModalWrapper
          open={showSaveModal}
          initialName={projectName}
          onConfirm={doSaveProject}
          onCancel={() => setShowSaveModal(false)}
        />

        {/* Модалка предпросмотра строки */}
        {state.csvData && (
          <RowPreviewModal
            open={showRowPreview}
            image={state.imageRef.current}
            imageWidth={state.imageSize?.width || 0}
            imageHeight={state.imageSize?.height || 0}
            layers={state.layers}
            csvData={state.csvData}
            rowIndex={rowPreviewIndex}
            onClose={() => setShowRowPreview(false)}
            onPrevRow={handlePrevRow}
            onNextRow={handleNextRow}
          />
        )}

        {/* Модалка подтверждения сброса */}
        {showResetConfirm && (
          <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal__title">Сбросить проект?</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Все несохранённые изменения будут потеряны.
              </p>
              <div className="modal__actions">
                <button className="btn btn--ghost" onClick={() => setShowResetConfirm(false)}>
                  Отмена
                </button>
                <button className="btn btn--danger" onClick={doReset}>
                  Сбросить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Селектор строки предпросмотра */}
        {hasCsv && state.csvData && (
          <div className="preview-row-selector">
            <span className="preview-row-selector__label">Предпросмотр:</span>
            <select
              className="preview-row-selector__select"
              value={state.previewRowIndex}
              onChange={(e) => state.setPreviewRowIndex(parseInt(e.target.value, 10))}
            >
              {state.csvData.rows.map((row, i) => (
                <option key={i} value={i}>
                  Строка {i + 1}: {row.slice(0, 3).join(', ')}{row.length > 3 ? '...' : ''}
                </option>
              ))}
            </select>
            <button
              className="btn btn--ghost btn--small"
              onClick={() => {
                setRowPreviewIndex(state.previewRowIndex);
                setShowRowPreview(true);
              }}
              title="Открыть полный предпросмотр"
            >
              🔍
            </button>
          </div>
        )}
      </ErrorBoundary>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

export default App;

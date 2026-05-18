import { useState, useCallback } from 'react';
import { useAppState } from './hooks/useAppState';
import { FileUploader } from './components/FileUploader';
import { CanvasEditor } from './components/CanvasEditor';
import { LayerPanel } from './components/LayerPanel';
import { ImageGenerator } from './components/ImageGenerator';
import { ProjectSelector } from './components/ProjectSelector';
import { SaveProjectModalWrapper } from './components/SaveProjectModal';
import type { SaveProjectData } from './components/SaveProjectModal';
import {
  loadProject,
  saveProject,
  generateProjectId,
  resetRootHandle,
} from './utils/projectStorage';
import type { ProjectRecord } from './types';

type Screen = 'selector' | 'editor';

function App() {
  const state = useAppState();
  const [screen, setScreen] = useState<Screen>('selector');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const hasImage = state.imageUrl !== null && state.imageSize !== null;
  const hasCsv = state.csvData !== null;

  // Загрузка проекта
  const handleSelectProject = useCallback(
    async (id: string) => {
      try {
        const record = await loadProject(id);
        if (!record) return;

        // Восстанавливаем изображение из blob
        const imageUrl = URL.createObjectURL(record.imageBlob);
        const img = new Image();
        img.crossOrigin = 'anonymous';
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
          // Освобождаем URL при ошибке загрузки изображения
          URL.revokeObjectURL(imageUrl);
          console.error('Failed to load project image');
        };
        img.src = imageUrl;

        setCurrentProjectId(record.id);
        setProjectName(record.name);
        setImageFileName(record.imageFileName);
        setCsvFileName(record.csvFileName);
        setScreen('editor');
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    },
    [state]
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

  // Сохранение проекта (вызывается после ввода данных в модалке)
  const doSaveProject = useCallback(
    async (saveData: SaveProjectData) => {
      if (!state.imageUrl || !state.imageSize || !state.csvData) return;
      setProjectName(saveData.name);
      setShowSaveModal(false);

      setSaving(true);
      setSaveMessage(null);
      try {
        const response = await fetch(state.imageUrl);
        const imageBlob = await response.blob();

        const id = currentProjectId || generateProjectId();
        const now = new Date().toISOString();

        // При пересохранении пытаемся загрузить старый createdAt
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
        setSaveMessage('Проект сохранён ✓');
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (err) {
        console.error('Failed to save project:', err);
        setSaveMessage('Ошибка сохранения');
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
    ]
  );

  // Показываем модалку сохранения
  const handleSaveProject = useCallback(() => {
    if (!state.imageUrl || !state.imageSize || !state.csvData) return;
    setShowSaveModal(true);
  }, [state.imageUrl, state.imageSize, state.csvData]);

  const handleImageLoad = useCallback(
    (file: File) => {
      setImageFileName(file.name);
      state.handleImageLoad(file);
    },
    [state]
  );

  const handleCsvLoad = useCallback(
    async (file: File) => {
      setCsvFileName(file.name);
      await state.handleCsvLoad(file);
    },
    [state]
  );

  const handleReset = useCallback(() => {
    setImageFileName('');
    setCsvFileName('');
    state.resetAll();
  }, [state]);

  // Сброс корневой папки проектов
  const handleChangeFolder = useCallback(async () => {
    await resetRootHandle();
    setSaveMessage('Папка сброшена. Выберите новую при следующем сохранении.');
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  // Показываем ProjectSelector при старте
  if (screen === 'selector') {
    return (
      <div className="app">
        <ProjectSelector
          onSelectProject={handleSelectProject}
          onCreateNew={handleCreateNew}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__emblem">ДК</span>
          <h1>Для Коли</h1>
        </div>
        <p className="app-header__subtitle">
          {projectName || 'Новый проект'}
        </p>
        <div className="app-header__actions">
          <button
            className="btn--back"
            onClick={() => setScreen('selector')}
            title="К списку проектов"
          >
            ← Проекты
          </button>

          {hasImage && (
            <>
              <button
                className="btn--save"
                onClick={handleSaveProject}
                disabled={saving || !hasCsv}
              >
                {saving ? '⏳' : '💾'} {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn--reset" onClick={handleReset}>
                Сбросить
              </button>
            </>
          )}

          <button
            className="btn--folder"
            onClick={handleChangeFolder}
            title="Сменить папку для проектов"
          >
            📁
          </button>

          {saveMessage && (
            <span className="app-header__save-msg">{saveMessage}</span>
          )}
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
                  />
                </>
              )}
            </div>

            <div className="app-layout__canvas">
              {hasImage && state.imageSize && (
                <CanvasEditor
                  imageUrl={state.imageUrl!}
                  imageWidth={state.imageSize.width}
                  imageHeight={state.imageSize.height}
                  layers={state.layers}
                  selectedLayerId={state.selectedLayerId}
                  isDragging={state.isDragging}
                  isResizing={state.isResizing}
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

      <SaveProjectModalWrapper
        open={showSaveModal}
        initialName={projectName}
        onConfirm={doSaveProject}
        onCancel={() => setShowSaveModal(false)}
      />
    </div>
  );
}

export default App;

import { useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { FileUploader } from './components/FileUploader';
import { CanvasEditor } from './components/CanvasEditor';
import { LayerPanel } from './components/LayerPanel';
import { ImageGenerator } from './components/ImageGenerator';

function App() {
  const state = useAppState();
  const [imageFileName, setImageFileName] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');

  const hasImage = state.imageUrl !== null && state.imageSize !== null;
  const hasCsv = state.csvData !== null;

  const handleImageLoad = (file: File) => {
    setImageFileName(file.name);
    state.handleImageLoad(file);
  };

  const handleCsvLoad = (file: File) => {
    setCsvFileName(file.name);
    state.handleCsvLoad(file);
  };

  const handleReset = () => {
    setImageFileName('');
    setCsvFileName('');
    state.resetAll();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__emblem">ДК</span>
          <h1>Для Коли</h1>
        </div>
        <p className="app-header__subtitle">
          Генератор изображений с текстом из CSV
        </p>
        <div className="app-header__actions">
          {hasImage && (
            <button className="btn btn--danger btn--small" onClick={handleReset}>
              Сбросить
            </button>
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
                  onUpdateLayer={state.updateLayer}
                />
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

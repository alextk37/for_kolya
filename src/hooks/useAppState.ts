import { useState, useCallback, useRef } from 'react';
import type { TextLayer, CsvData, BarcodeOptions } from '../types';
import { parseCsvFile } from '../utils/csvParser';

const DEFAULT_LAYER_WIDTH = 200;
const DEFAULT_LAYER_HEIGHT = 50;
const MAX_UNDO_HISTORY = 50;

function isBarcodeColumn(columnName: string): boolean {
  return /^EAN13/i.test(columnName.trim());
}

function createDefaultBarcodeOptions(): BarcodeOptions {
  return {
    height: 40,
    width: 1,
    displayValue: true,
    fontSize: 12,
    lineColor: '#010101',
    background: '#ffffff',
    margin: 4,
  };
}

export function useAppState() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // --- Новые состояния ---
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // --- Undo/Redo ---
  const undoStackRef = useRef<TextLayer[][]>([]);
  const redoStackRef = useRef<TextLayer[][]>([]);

  /** Сохраняет текущее состояние слоёв в undo-стек перед изменением */
  const pushUndo = useCallback((currentLayers: TextLayer[]) => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(currentLayers)));
    if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
      undoStackRef.current.shift();
    }
    // При новом изменении очищаем redo-стек
    redoStackRef.current = [];
    setIsDirty(true);
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(JSON.parse(JSON.stringify(layers)));
    setLayers(prev);
    setIsDirty(true);
  }, [layers]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(JSON.parse(JSON.stringify(layers)));
    setLayers(next);
    setIsDirty(true);
  }, [layers]);

  const canUndo = useCallback(() => undoStackRef.current.length > 0, []);
  const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

  // --- Загрузка изображения ---
  const handleImageLoad = useCallback((file: File) => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    if (url.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      imageRef.current = img;
    };
    img.src = url;
    setIsDirty(true);
  }, [imageUrl]);

  // --- Загрузка CSV ---
  const handleCsvLoad = useCallback(async (file: File) => {
    try {
      const data = await parseCsvFile(file);
      setCsvData(data);

      // Create layers based on columns — улучшенное начальное расположение
      const newLayers: TextLayer[] = data.headers.map((header, index) => {
        const isBarcode = isBarcodeColumn(header);
        return {
          id: `layer-${index}`,
          columnIndex: index,
          columnName: header,
          x: 20 + (index % 3) * 250,
          y: 20 + Math.floor(index / 3) * 80,
          width: isBarcode ? 260 : DEFAULT_LAYER_WIDTH,
          height: isBarcode ? 60 : DEFAULT_LAYER_HEIGHT,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#010101',
          textAlign: 'left' as CanvasTextAlign,
          fontStyle: 'normal',
          rotation: 0,
          isBarcode,
          barcodeOptions: createDefaultBarcodeOptions(),
          visible: true,
          locked: false,
          order: index,
        };
      });

      setLayers(newLayers);
      if (newLayers.length > 0) {
        setSelectedLayerId(newLayers[0].id);
      }
      setPreviewRowIndex(0);
      setIsDirty(true);
    } catch (err) {
      console.error('Failed to parse CSV:', err);
    }
  }, []);

  // --- Обновление слоя (с undo) ---
  const updateLayer = useCallback((layerId: string, updates: Partial<TextLayer>) => {
    setLayers((prev) => {
      pushUndo(prev);
      return prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer));
    });
  }, [pushUndo]);

  const selectLayer = useCallback((layerId: string | null) => {
    setSelectedLayerId(layerId);
  }, []);

  // --- Управление слоями ---

  /** Удалить слой */
  const deleteLayer = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      const filtered = prev.filter((l) => l.id !== layerId);
      // Пересчитываем order
      return filtered.map((l, i) => ({ ...l, order: i }));
    });
    // Если удалён выбранный слой — снимаем выделение
    setSelectedLayerId((prev) => (prev === layerId ? null : prev));
  }, [pushUndo]);

  /** Дублировать слой */
  const duplicateLayer = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      const source = prev.find((l) => l.id === layerId);
      if (!source) return prev;
      const newId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newLayer: TextLayer = {
        ...source,
        id: newId,
        x: source.x + 20,
        y: source.y + 20,
        order: prev.length,
      };
      return [...prev, newLayer];
    });
  }, [pushUndo]);

  /** Переключить видимость слоя */
  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      return prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l));
    });
  }, [pushUndo]);

  /** Переключить блокировку слоя */
  const toggleLayerLock = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      return prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l));
    });
  }, [pushUndo]);

  /** Переместить слой вверх (по z-order) */
  const moveLayerUp = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === layerId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      // Swap order with next
      const temp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[idx + 1].order };
      sorted[idx + 1] = { ...sorted[idx + 1], order: temp };
      return sorted;
    });
  }, [pushUndo]);

  /** Переместить слой вниз (по z-order) */
  const moveLayerDown = useCallback((layerId: string) => {
    setLayers((prev) => {
      pushUndo(prev);
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === layerId);
      if (idx <= 0) return prev;
      // Swap order with previous
      const temp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[idx - 1].order };
      sorted[idx - 1] = { ...sorted[idx - 1], order: temp };
      return sorted;
    });
  }, [pushUndo]);

  // --- Drag ---

  const startDrag = useCallback(
    (layerId: string, clientX: number, clientY: number, canvasRect: DOMRect) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer || layer.locked) return;

      const scaleX = (imageSize?.width || 1) / canvasRect.width;
      const scaleY = (imageSize?.height || 1) / canvasRect.height;

      setIsDragging(true);
      setSelectedLayerId(layerId);
      setDragOffset({
        x: clientX - layer.x / scaleX,
        y: clientY - layer.y / scaleY,
      });
    },
    [layers, imageSize]
  );

  const doDrag = useCallback(
    (clientX: number, clientY: number, canvasRect: DOMRect) => {
      if (!isDragging || !dragOffset || !selectedLayerId || !imageSize) return;

      const layer = layers.find((l) => l.id === selectedLayerId);
      if (layer?.locked) return;

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      const newX = (clientX - dragOffset.x) * scaleX;
      const newY = (clientY - dragOffset.y) * scaleY;

      updateLayer(selectedLayerId, {
        x: Math.max(0, newX),
        y: Math.max(0, newY),
      });
    },
    [isDragging, dragOffset, selectedLayerId, imageSize, layers, updateLayer]
  );

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDragOffset(null);
  }, []);

  // --- Resize ---

  const startResize = useCallback(
    (layerId: string, handle: string, clientX: number, clientY: number, canvasRect: DOMRect) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer || !imageSize || layer.locked) return;

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      setIsResizing(true);
      setResizeHandle(handle);
      setSelectedLayerId(layerId);
      setDragOffset({
        x: clientX * scaleX,
        y: clientY * scaleY,
      });
      resizeStartRef.current = {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      };
    },
    [layers, imageSize]
  );

  const doResize = useCallback(
    (clientX: number, clientY: number, canvasRect: DOMRect) => {
      if (!isResizing || !resizeHandle || !selectedLayerId || !imageSize || !dragOffset) return;

      const start = resizeStartRef.current;
      if (!start) return;

      const layer = layers.find((l) => l.id === selectedLayerId);
      if (layer?.locked) return;

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      const mouseImgX = clientX * scaleX;
      const mouseImgY = clientY * scaleY;

      const deltaX = mouseImgX - dragOffset.x;
      const deltaY = mouseImgY - dragOffset.y;

      const updates: Partial<TextLayer> = {};

      if (resizeHandle.includes('e')) {
        updates.width = Math.max(50, start.width + deltaX);
      }
      if (resizeHandle.includes('s')) {
        updates.height = Math.max(20, start.height + deltaY);
      }
      if (resizeHandle.includes('w')) {
        const newWidth = Math.max(50, start.width - deltaX);
        updates.x = start.x + (start.width - newWidth);
        updates.width = newWidth;
      }
      if (resizeHandle.includes('n')) {
        const newHeight = Math.max(20, start.height - deltaY);
        updates.y = start.y + (start.height - newHeight);
        updates.height = newHeight;
      }

      updateLayer(selectedLayerId, updates);
    },
    [isResizing, resizeHandle, selectedLayerId, imageSize, dragOffset, layers, updateLayer]
  );

  const endResize = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    setDragOffset(null);
    resizeStartRef.current = null;
  }, []);

  // --- Сброс ---

  const resetAll = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setImageSize(null);
    setCsvData(null);
    setLayers([]);
    setSelectedLayerId(null);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragOffset(null);
    setIsGenerating(false);
    setGeneratedCount(0);
    setPreviewRowIndex(0);
    setIsDirty(false);
    imageRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [imageUrl]);

  // --- Загрузка из проекта ---

  const loadFromProject = useCallback(
    (
      url: string,
      size: { width: number; height: number },
      csv: CsvData,
      projectLayers: TextLayer[],
      img: HTMLImageElement
    ) => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setImageUrl(url);
      setImageSize(size);
      setCsvData(csv);
      // Обеспечиваем обратную совместимость — добавляем visible/locked/order если их нет
      setLayers(
        projectLayers.map((l, i) => ({
          ...l,
          // Обратная совместимость: добавляем дефолты для старых проектов без этих полей
          visible: l.visible ?? true,
          locked: l.locked ?? false,
          order: l.order ?? i,
        }))
      );
      setSelectedLayerId(projectLayers.length > 0 ? projectLayers[0].id : null);
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragOffset(null);
      setIsGenerating(false);
      setGeneratedCount(0);
      setPreviewRowIndex(0);
      setIsDirty(false);
      imageRef.current = img;
      undoStackRef.current = [];
      redoStackRef.current = [];
    },
    [imageUrl]
  );

  /** Сбросить флаг isDirty (вызывается после сохранения) */
  const markSaved = useCallback(() => {
    setIsDirty(false);
  }, []);

  return {
    imageUrl,
    imageSize,
    csvData,
    layers,
    selectedLayerId,
    isDragging,
    isResizing,
    resizeHandle,
    dragOffset,
    isGenerating,
    generatedCount,
    imageRef,
    previewRowIndex,
    isDirty,
    handleImageLoad,
    handleCsvLoad,
    updateLayer,
    selectLayer,
    deleteLayer,
    duplicateLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    moveLayerUp,
    moveLayerDown,
    startDrag,
    doDrag,
    endDrag,
    startResize,
    doResize,
    endResize,
    resetAll,
    loadFromProject,
    setIsGenerating,
    setGeneratedCount,
    setPreviewRowIndex,
    undo,
    redo,
    canUndo,
    canRedo,
    markSaved,
  };
}

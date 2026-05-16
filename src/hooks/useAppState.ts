import { useState, useCallback, useRef } from 'react';
import type { TextLayer, CsvData, BarcodeOptions } from '../types';
import { parseCsvFile } from '../utils/csvParser';

const DEFAULT_LAYER_WIDTH = 200;
const DEFAULT_LAYER_HEIGHT = 50;

function isBarcodeColumn(columnName: string): boolean {
  return /^EAN13/i.test(columnName.trim());
}

function createDefaultBarcodeOptions(): BarcodeOptions {
  return {
    height: 40,
    width: 1,
    displayValue: true,
    fontSize: 12,
    lineColor: '#000000',
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

  const handleImageLoad = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      imageRef.current = img;
    };
    img.src = url;
  }, []);

  const handleCsvLoad = useCallback(async (file: File) => {
    try {
      const data = await parseCsvFile(file);
      setCsvData(data);

      // Create layers based on columns
      const newLayers: TextLayer[] = data.headers.map((header, index) => {
        const isBarcode = isBarcodeColumn(header);
        return {
          id: `layer-${index}`,
          columnIndex: index,
          columnName: header,
          x: 20 + index * 20,
          y: 20 + index * 40,
          width: isBarcode ? 260 : DEFAULT_LAYER_WIDTH,
          height: isBarcode ? 60 : DEFAULT_LAYER_HEIGHT,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000',
          textAlign: 'left' as CanvasTextAlign,
          fontStyle: 'normal',
          rotation: 0,
          isBarcode,
          barcodeOptions: createDefaultBarcodeOptions(),
        };
      });

      setLayers(newLayers);
      if (newLayers.length > 0) {
        setSelectedLayerId(newLayers[0].id);
      }
    } catch (err) {
      console.error('Failed to parse CSV:', err);
    }
  }, []);

  const updateLayer = useCallback((layerId: string, updates: Partial<TextLayer>) => {
    setLayers((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
    );
  }, []);

  const selectLayer = useCallback((layerId: string | null) => {
    setSelectedLayerId(layerId);
  }, []);

  const startDrag = useCallback(
    (layerId: string, clientX: number, clientY: number, canvasRect: DOMRect) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer) return;

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

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      const newX = (clientX - dragOffset.x) * scaleX;
      const newY = (clientY - dragOffset.y) * scaleY;

      updateLayer(selectedLayerId, {
        x: Math.max(0, newX),
        y: Math.max(0, newY),
      });
    },
    [isDragging, dragOffset, selectedLayerId, imageSize, updateLayer]
  );

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDragOffset(null);
  }, []);

  const startResize = useCallback(
    (layerId: string, handle: string, clientX: number, clientY: number, canvasRect: DOMRect) => {
      const layer = layers.find((l) => l.id === layerId);
      if (!layer || !imageSize) return;

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      setIsResizing(true);
      setResizeHandle(handle);
      setSelectedLayerId(layerId);
      // Сохраняем начальную позицию мыши в координатах изображения
      setDragOffset({
        x: clientX * scaleX,
        y: clientY * scaleY,
      });
      // Сохраняем начальные размеры и позицию слоя в ref
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

      const scaleX = imageSize.width / canvasRect.width;
      const scaleY = imageSize.height / canvasRect.height;

      // Текущая позиция мыши в координатах изображения
      const mouseImgX = clientX * scaleX;
      const mouseImgY = clientY * scaleY;

      // Смещение мыши от начальной позиции (в координатах изображения)
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
    [isResizing, resizeHandle, selectedLayerId, imageSize, dragOffset, updateLayer]
  );

  const endResize = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
    setDragOffset(null);
    resizeStartRef.current = null;
  }, []);


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
    imageRef.current = null;
  }, [imageUrl]);

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
    handleImageLoad,
    handleCsvLoad,
    updateLayer,
    selectLayer,
    startDrag,
    doDrag,
    endDrag,
    startResize,
    doResize,
    endResize,
    resetAll,
    setIsGenerating,
    setGeneratedCount,
  };
}

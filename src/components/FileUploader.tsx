import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  onImageLoad: (file: File) => void;
  onCsvLoad: (file: File) => void;
  hasImage: boolean;
  hasCsv: boolean;
  imageName?: string;
  csvName?: string;
}

export function FileUploader({
  onImageLoad,
  onCsvLoad,
  hasImage,
  hasCsv,
  imageName,
  csvName,
}: FileUploaderProps) {
  const onImageDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onImageLoad(acceptedFiles[0]);
      }
    },
    [onImageLoad]
  );

  const onCsvDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onCsvLoad(acceptedFiles[0]);
      }
    },
    [onCsvLoad]
  );

  const imageDropzone = useDropzone({
    onDrop: onImageDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.bmp'] },
    maxFiles: 1,
    disabled: false, // Всегда разрешаем замену
  });

  const csvDropzone = useDropzone({
    onDrop: onCsvDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'] },
    maxFiles: 1,
    disabled: false, // Всегда разрешаем замену
  });

  return (
    <div className="file-uploader">
      <div
        {...imageDropzone.getRootProps()}
        className={`dropzone ${hasImage ? 'dropzone--loaded' : ''} ${imageDropzone.isDragActive ? 'dropzone--drag-active' : ''}`}
      >
        <input {...imageDropzone.getInputProps()} />
        {hasImage ? (
          <div className="dropzone__content">
            <span className="dropzone__icon">🖼️</span>
            <span className="dropzone__filename">{imageName || 'Изображение загружено'}</span>
            <span className="dropzone__replace-hint">Перетащите или кликните для замены</span>
          </div>
        ) : (
          <>
            <span className="dropzone__icon">📁</span>
            <p className="dropzone__text">
              <strong>Загрузите изображение</strong>
              <br />
              PNG, JPG, SVG, WebP или BMP
            </p>
            <p className="dropzone__hint">Перетащите файл или кликните для выбора</p>
          </>
        )}
      </div>

      <div
        {...csvDropzone.getRootProps()}
        className={`dropzone ${hasCsv ? 'dropzone--loaded' : ''} ${csvDropzone.isDragActive ? 'dropzone--drag-active' : ''}`}
      >
        <input {...csvDropzone.getInputProps()} />
        {hasCsv ? (
          <div className="dropzone__content">
            <span className="dropzone__icon">📊</span>
            <span className="dropzone__filename">{csvName || 'CSV загружен'}</span>
            <span className="dropzone__replace-hint">Перетащите или кликните для замены</span>
          </div>
        ) : (
          <>
            <span className="dropzone__icon">📄</span>
            <p className="dropzone__text">
              <strong>Загрузите CSV файл</strong>
              <br />
              С данными для подстановки в слои
            </p>
            <p className="dropzone__hint">Перетащите файл или кликните для выбора</p>
          </>
        )}
      </div>
    </div>
  );
}

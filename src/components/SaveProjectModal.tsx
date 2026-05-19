import { useState, useRef, useEffect } from 'react';

interface SaveProjectModalProps {
  open: boolean;
  initialName?: string;
  onConfirm: (data: SaveProjectData) => void;
  onCancel: () => void;
}

export interface SaveProjectData {
  name: string;
  folderHandle: FileSystemDirectoryHandle | null;
  imageFormat: 'png' | 'jpg';
}

export function SaveProjectModal({
  open,
  initialName = '',
  onConfirm,
  onCancel,
}: SaveProjectModalProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png');

  // FSA поддерживается в Chrome/Edge, но НЕ в Electron (там showDirectoryPicker зависает)
  const isElectron = !!window.electronAPI?.isElectron;
  const fsaSupported = !isElectron && 'showDirectoryPicker' in window;

  // Фокус на поле имени при открытии
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.select();
      });
    }
  }, [open]);

  // Escape для закрытия
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  const handleSelectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({
        id: 'for_kolya_save_project',
        mode: 'readwrite',
        startIn: 'documents',
      });
      setFolderHandle(handle);
      setFolderName(handle.name);
    } catch {
      // Пользователь отменил выбор
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onConfirm({
      name: trimmedName,
      folderHandle,
      imageFormat,
    });
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--save" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">Сохранить проект</h3>

        <form onSubmit={handleSubmit}>
          {/* Название проекта */}
          <div className="modal__field">
            <label className="modal__label">Название проекта</label>
            <input
              ref={nameRef}
              className="modal__input"
              type="text"
              placeholder="Введите название проекта"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Выбор папки — только для Chrome/Edge */}
          {fsaSupported && (
            <div className="modal__field">
              <label className="modal__label">Папка для сохранения</label>
              <div className="modal__folder-row">
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={handleSelectFolder}
                >
                  {folderHandle ? '📁 Изменить папку' : '📁 Выбрать папку'}
                </button>
                {folderName && (
                  <span className="modal__folder-name" title={folderName}>
                    {folderName}
                  </span>
                )}
                {!folderName && (
                  <span className="modal__folder-hint">
                    (будет создана подпапка в корне проектов)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Для Firefox/Safari — пояснение */}
          {!fsaSupported && (
            <div className="modal__field">
              <div className="modal__note">
                <span className="modal__note-icon">ℹ️</span>
                <span>
                  Проект будет сохранён в браузере. Вы сможете скачать ZIP-архив
                  проекта на странице проектов.
                </span>
              </div>
            </div>
          )}

          {/* Формат изображения */}
          <div className="modal__field">
            <label className="modal__label">Формат изображения</label>
            <div className="modal__radio-group">
              <label className={`modal__radio${imageFormat === 'png' ? ' modal__radio--checked' : ''}`}>
                <input
                  type="radio"
                  name="imageFormat"
                  value="png"
                  checked={imageFormat === 'png'}
                  onChange={() => setImageFormat('png')}
                />
                <span>PNG (без потерь)</span>
              </label>
              <label className={`modal__radio${imageFormat === 'jpg' ? ' modal__radio--checked' : ''}`}>
                <input
                  type="radio"
                  name="imageFormat"
                  value="jpg"
                  checked={imageFormat === 'jpg'}
                  onChange={() => setImageFormat('jpg')}
                />
                <span>JPG (меньше размер)</span>
              </label>
            </div>
          </div>

          {/* Кнопки */}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!name.trim()}
            >
              💾 Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Обёртка для SaveProjectModal с автоматическим сбросом состояния при открытии.
 */
export function SaveProjectModalWrapper(props: SaveProjectModalProps) {
  return <SaveProjectModal key={props.open ? 'open' : 'closed'} {...props} />;
}

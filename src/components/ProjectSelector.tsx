import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectManifest } from '../types';
import {
  listProjects,
  deleteProject,
  isFileSystemAccessSupported,
  downloadProjectAsZip,
  importProjectFromZip,
  loadProject,
} from '../utils/projectStorage';

interface ProjectSelectorProps {
  onSelectProject: (id: string) => void;
  onCreateNew: () => void;
}

export function ProjectSelector({ onSelectProject, onCreateNew }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [showProjectList, setShowProjectList] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const fsaSupported = isFileSystemAccessSupported();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем проекты при монтировании
  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((list) => {
        if (cancelled) return;
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setProjects(list);
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load projects:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteProject(id);
        setConfirmDeleteId(null);
        refresh();
      } catch (err) {
        console.error('Failed to delete project:', err);
      }
    },
    [refresh]
  );

  const handleExport = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExportingId(id);
      try {
        const record = await loadProject(id);
        if (record) {
          await downloadProjectAsZip(record);
        }
      } catch (err) {
        console.error('Failed to export project:', err);
      } finally {
        setExportingId(null);
      }
    },
    []
  );

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const record = await importProjectFromZip(file);
        if (record) {
          const { saveProject } = await import('../utils/projectStorage');
          await saveProject(record);
          refresh();
        } else {
          alert('Не удалось загрузить проект: неверный формат ZIP-архива');
        }
      } catch (err) {
        console.error('Failed to import project:', err);
        alert('Ошибка при импорте проекта');
      }

      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    },
    [refresh]
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин. назад`;
    if (diffHour < 24) return `${diffHour} ч. назад`;
    if (diffDay < 7) return `${diffDay} дн. назад`;

    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <main className="app-main app-main--centered">
      <div className="project-selector">
        {/* Hero */}
        <div className="project-selector__hero">
          <div className="empty-state__emblem">ДК</div>
          <h2 className="empty-state__title">Для Коли</h2>
          <p className="empty-state__text">
            Генератор изображений с подстановкой текста из CSV данных
          </p>
        </div>

        {/* Главные кнопки: Открыть проект / Новый проект */}
        <div className="project-selector__main-actions">
          <button
            className="project-selector__main-btn project-selector__main-btn--open"
            onClick={() => {
              refresh();
              setShowProjectList(true);
            }}
          >
            <span className="project-selector__main-btn-icon">📂</span>
            <span className="project-selector__main-btn-label">Открыть проект</span>
            <span className="project-selector__main-btn-hint">
              {loading ? 'Загрузка...' : `${projects.length} сохранённых`}
            </span>
          </button>

          <button
            className="project-selector__main-btn project-selector__main-btn--new"
            onClick={onCreateNew}
          >
            <span className="project-selector__main-btn-icon">➕</span>
            <span className="project-selector__main-btn-label">Новый проект</span>
            <span className="project-selector__main-btn-hint">
              Создать с чистого листа
            </span>
          </button>
        </div>

        {/* Список проектов (показывается после нажатия "Открыть проект") */}
        {showProjectList && !loading && projects.length > 0 && (
          <div className="project-selector__list">
            <div className="project-selector__list-header">
              <h3 className="project-selector__list-title">Сохранённые проекты</h3>
              <span className="project-selector__list-count">{projects.length}</span>
            </div>
            {projects.map((proj, idx) => (
              <div
                key={proj.id}
                className="project-selector__card"
                onClick={() => onSelectProject(proj.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectProject(proj.id);
                }}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div className="project-selector__card-icon">
                  {getInitials(proj.name)}
                </div>
                <div className="project-selector__card-body">
                  <span className="project-selector__card-name">{proj.name}</span>
                  <span className="project-selector__card-meta">
                    🖼 {proj.imageFileName} · 📊 {proj.csvFileName}
                  </span>
                  <span className="project-selector__card-date">
                    {formatDate(proj.updatedAt)}
                  </span>
                </div>
                <div className="project-selector__card-actions">
                  {!fsaSupported && (
                    <button
                      className="btn btn--ghost project-selector__export-btn"
                      title="Скачать ZIP-архив проекта"
                      onClick={(e) => handleExport(proj.id, e)}
                      disabled={exportingId === proj.id}
                    >
                      {exportingId === proj.id ? '⏳' : '⬇'}
                    </button>
                  )}

                  {confirmDeleteId === proj.id ? (
                    <div className="project-selector__confirm">
                      <span>Удалить?</span>
                      <button
                        className="btn btn--danger btn--tiny"
                        onClick={(e) => handleDelete(proj.id, e)}
                      >
                        Да
                      </button>
                      <button
                        className="btn btn--ghost btn--tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn--ghost project-selector__delete-btn"
                      title="Удалить проект"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(proj.id);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Пусто (когда нет проектов и нажали "Открыть проект") */}
        {showProjectList && !loading && projects.length === 0 && (
          <div className="project-selector__empty-state">
            <div className="project-selector__empty-icon">📂</div>
            <p className="project-selector__empty-text">
              У вас пока нет сохранённых проектов.
            </p>
          </div>
        )}

        {/* Импорт проекта (для Firefox/Safari) */}
        {!fsaSupported && (
          <div className="project-selector__import-row">
            <button
              className="btn btn--ghost btn--small"
              onClick={() => importInputRef.current?.click()}
            >
              📥 Импорт проекта из ZIP
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        )}
      </div>
    </main>
  );
}

import type { ProjectManifest, ProjectRecord } from '../types';

/**
 * Хранилище проектов с автоопределением доступного API.
 *
 * 1. File System Access API (Chrome/Edge/Opera/Yandex)
 *    - Пользователь выбирает папку через диалог
 *    - Проекты сохраняются как подпапки с manifest.json + image.png
 *    - Handle папки сохраняется в IndexedDB для повторного использования
 *
 * 2. Fallback (Firefox/Safari/остальные)
 *    - Сохранение: скачивание ZIP-архива с проектом
 *    - Загрузка: выбор ZIP-файла через <input>
 *    - Список проектов: IndexedDB (только метаданные, без blob'ов)
 */

// ============================================================
//   Определение поддержки File System Access API
// ============================================================

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

// ============================================================
//   Общие утилиты
// ============================================================

export function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100) || 'project';
}

// ============================================================
//   File System Access API — реализация
// ============================================================

const HANDLE_STORE_KEY = 'fs_project_root_handle';

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('for_kolya_fs_handle', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      store.put(handle, HANDLE_STORE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('for_kolya_fs_handle', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const get = store.get(HANDLE_STORE_KEY);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearStoredHandle(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('for_kolya_fs_handle', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      store.delete(HANDLE_STORE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getOrRequestRootHandle(): Promise<FileSystemDirectoryHandle> {
  const stored = await loadStoredHandle();
  if (stored) {
    try {
      await stored.requestPermission({ mode: 'readwrite' });
      return stored;
    } catch {
      // разрешение отозвано
    }
  }

  const handle = await window.showDirectoryPicker({
    id: 'for_kolya_projects',
    mode: 'readwrite',
    startIn: 'documents',
  });

  await storeHandle(handle);
  return handle;
}

async function ensureProjectDir(
  rootHandle: FileSystemDirectoryHandle,
  projectName: string
): Promise<FileSystemDirectoryHandle> {
  const dirName = sanitizeFileName(projectName);
  return rootHandle.getDirectoryHandle(dirName, { create: true });
}

// ============================================================
//   IndexedDB — fallback хранилище метаданных
// ============================================================

const FALLBACK_DB_NAME = 'for_kolya_projects_fallback';
const FALLBACK_DB_VERSION = 1;
const FALLBACK_STORE = 'projects_meta';

/**
 * Проверяет, доступна ли IndexedDB (может быть заблокирована в приватном режиме).
 */
function isIndexedDBAvailable(): boolean {
  try {
    if (typeof indexedDB === 'undefined') return false;
    // Проверяем через открытие и закрытие тестовой БД
    const request = indexedDB.open('__test_db__');
    request.onupgradeneeded = () => {
      const db = request.result;
      db.close();
      indexedDB.deleteDatabase('__test_db__');
    };
    request.onerror = () => {
      indexedDB.deleteDatabase('__test_db__');
    };
    return true;
  } catch {
    return false;
  }
}

function openFallbackDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB недоступна (возможно, приватный режим)'));
      return;
    }
    const request = indexedDB.open(FALLBACK_DB_NAME, FALLBACK_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FALLBACK_STORE)) {
        const store = db.createObjectStore(FALLBACK_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Для fallback: сохраняем манифест в IndexedDB */
async function fallbackSaveManifest(manifest: ProjectManifest): Promise<void> {
  const db = await openFallbackDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, 'readwrite');
    const store = tx.objectStore(FALLBACK_STORE);
    store.put(manifest);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Для fallback: загружаем манифест из IndexedDB */
async function fallbackLoadManifest(id: string): Promise<ProjectManifest | null> {
  const db = await openFallbackDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, 'readonly');
    const store = tx.objectStore(FALLBACK_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/** Для fallback: список всех манифестов */
async function fallbackListManifests(): Promise<ProjectManifest[]> {
  const db = await openFallbackDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, 'readonly');
    const store = tx.objectStore(FALLBACK_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/** Для fallback: удаляем манифест */
async function fallbackDeleteManifest(id: string): Promise<void> {
  const db = await openFallbackDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, 'readwrite');
    const store = tx.objectStore(FALLBACK_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
//   Публичное API — listProjects
// ============================================================

export async function listProjects(): Promise<ProjectManifest[]> {
  // Сначала пробуем FSA без запроса разрешения (не показываем диалог выбора папки)
  if (isFileSystemAccessSupported()) {
    const fsaResult = await tryListProjectsFSA();
    if (fsaResult) return fsaResult;
  }
  return listProjectsFallback();
}

/**
 * Пытается получить список проектов через FSA без показа диалога выбора папки.
 * Возвращает null, если нет сохранённого доступа.
 */
async function tryListProjectsFSA(): Promise<ProjectManifest[] | null> {
  const stored = await loadStoredHandle();
  if (!stored) return null;

  let permission: PermissionState;
  try {
    permission = await stored.queryPermission({ mode: 'readwrite' });
  } catch {
    return null;
  }
  if (permission !== 'granted') return null;

  return listProjectsFromHandle(stored);
}

async function listProjectsFromHandle(rootHandle: FileSystemDirectoryHandle): Promise<ProjectManifest[]> {
  const manifests: ProjectManifest[] = [];

  for await (const [, entry] of rootHandle.entries()) {
    if (entry.kind !== 'directory') continue;
    try {
      const dirHandle = await rootHandle.getDirectoryHandle(entry.name);
      const manifestFileHandle = await dirHandle.getFileHandle('manifest.json');
      const file = await manifestFileHandle.getFile();
      const manifest: ProjectManifest = JSON.parse(await file.text());
      manifests.push(manifest);
    } catch {
      continue;
    }
  }

  manifests.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return manifests;
}

async function listProjectsFallback(): Promise<ProjectManifest[]> {
  try {
    const list = await fallbackListManifests();
    list.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return list;
  } catch {
    return [];
  }
}

// ============================================================
//   Публичное API — loadProject
// ============================================================

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  if (isFileSystemAccessSupported()) {
    return loadProjectFSA(id);
  }
  return loadProjectFallback(id);
}

async function loadProjectFSA(id: string): Promise<ProjectRecord | null> {
  let rootHandle: FileSystemDirectoryHandle;
  try {
    rootHandle = await getOrRequestRootHandle();
  } catch {
    return null;
  }

  for await (const [, entry] of rootHandle.entries()) {
    if (entry.kind !== 'directory') continue;
    try {
      const dirHandle = await rootHandle.getDirectoryHandle(entry.name);
      const manifestFileHandle = await dirHandle.getFileHandle('manifest.json');
      const manifestFile = await manifestFileHandle.getFile();
      const manifest: ProjectManifest = JSON.parse(await manifestFile.text());

      if (manifest.id !== id) continue;

      let imageBlob: Blob;
      try {
        const imageFileHandle = await dirHandle.getFileHandle('image.png');
        imageBlob = await imageFileHandle.getFile();
      } catch {
        const imageFileHandle = await dirHandle.getFileHandle('image.jpg');
        imageBlob = await imageFileHandle.getFile();
      }

      return { ...manifest, imageBlob };
    } catch {
      continue;
    }
  }

  return null;
}

/** Для fallback: хранилище blob'ов в отдельной IndexedDB */
const BLOB_DB_NAME = 'for_kolya_projects_blobs';
const BLOB_DB_VERSION = 1;
const BLOB_STORE = 'blobs';

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BLOB_DB_NAME, BLOB_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function fallbackSaveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    const store = tx.objectStore(BLOB_STORE);
    store.put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fallbackLoadBlob(id: string): Promise<Blob | null> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly');
    const store = tx.objectStore(BLOB_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function fallbackDeleteBlob(id: string): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readwrite');
    const store = tx.objectStore(BLOB_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadProjectFallback(id: string): Promise<ProjectRecord | null> {
  try {
    const manifest = await fallbackLoadManifest(id);
    if (!manifest) return null;
    const imageBlob = await fallbackLoadBlob(id);
    if (!imageBlob) return null;
    return { ...manifest, imageBlob };
  } catch {
    return null;
  }
}

// ============================================================
//   Публичное API — saveProject
// ============================================================

export interface SaveProjectOptions {
  folderHandle?: FileSystemDirectoryHandle | null;
  imageFormat?: 'png' | 'jpg';
}

export async function saveProject(
  record: ProjectRecord,
  options?: SaveProjectOptions
): Promise<void> {
  if (isFileSystemAccessSupported()) {
    return saveProjectFSA(record, options);
  }
  return saveProjectFallback(record);
}

async function saveProjectFSA(
  record: ProjectRecord,
  options?: SaveProjectOptions
): Promise<void> {
  const imageFormat = options?.imageFormat || 'png';
  const imageExt = imageFormat === 'jpg' ? 'jpg' : 'png';

  let targetDir: FileSystemDirectoryHandle;

  if (options?.folderHandle) {
    targetDir = options.folderHandle;
  } else {
    const rootHandle = await getOrRequestRootHandle();
    targetDir = await ensureProjectDir(rootHandle, record.name);
  }

  const { imageBlob: _blob, ...manifest } = record;
  void _blob;

  // manifest.json
  const manifestFileHandle = await targetDir.getFileHandle('manifest.json', { create: true });
  const writableManifest = await manifestFileHandle.createWritable();
  await writableManifest.write(JSON.stringify(manifest, null, 2));
  await writableManifest.close();

  // image
  const imageFileName = `image.${imageExt}`;
  const imageFileHandle = await targetDir.getFileHandle(imageFileName, { create: true });
  const writableImage = await imageFileHandle.createWritable();

  if (imageFormat === 'jpg') {
    const img = await createImageFromBlob(record.imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
    );
    await writableImage.write(blob);
  } else {
    await writableImage.write(record.imageBlob);
  }

  await writableImage.close();
}

async function saveProjectFallback(record: ProjectRecord): Promise<void> {
  const { imageBlob, ...manifest } = record;
  await fallbackSaveManifest(manifest);
  await fallbackSaveBlob(record.id, imageBlob);
}

// ============================================================
//   Публичное API — deleteProject
// ============================================================

export async function deleteProject(id: string): Promise<void> {
  if (isFileSystemAccessSupported()) {
    return deleteProjectFSA(id);
  }
  return deleteProjectFallback(id);
}

async function deleteProjectFSA(id: string): Promise<void> {
  const rootHandle = await getOrRequestRootHandle();

  for await (const [, entry] of rootHandle.entries()) {
    if (entry.kind !== 'directory') continue;
    try {
      const dirHandle = await rootHandle.getDirectoryHandle(entry.name);
      const manifestFileHandle = await dirHandle.getFileHandle('manifest.json');
      const manifestFile = await manifestFileHandle.getFile();
      const manifest: ProjectManifest = JSON.parse(await manifestFile.text());

      if (manifest.id !== id) continue;

      for await (const [fileName] of dirHandle.entries()) {
        await dirHandle.removeEntry(fileName);
      }
      await rootHandle.removeEntry(entry.name);
      return;
    } catch {
      continue;
    }
  }
}

async function deleteProjectFallback(id: string): Promise<void> {
  await fallbackDeleteManifest(id);
  await fallbackDeleteBlob(id);
}

// ============================================================
//   Управление корневой папкой (FSA)
// ============================================================

export async function resetRootHandle(): Promise<void> {
  await clearStoredHandle();
}

// ============================================================
//   Экспорт/импорт проектов (для fallback)
// ============================================================

/**
 * Скачивает проект как ZIP-архив (для Firefox/Safari).
 * Используем CompressionStream если доступен, иначе JSZip.
 */
export async function downloadProjectAsZip(record: ProjectRecord): Promise<void> {
  // Динамический импорт JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const { imageBlob, ...manifest } = record;

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('image.png', imageBlob);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileName(record.name)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Загружает проект из ZIP-файла.
 * Возвращает ProjectRecord или null.
 */
export async function importProjectFromZip(file: File): Promise<ProjectRecord | null> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) return null;

    const manifestText = await manifestFile.async('string');
    const manifest: ProjectManifest = JSON.parse(manifestText);

    const imageFile = zip.file('image.png') || zip.file('image.jpg');
    if (!imageFile) return null;

    const imageBlob = await imageFile.async('blob');

    return { ...manifest, imageBlob };
  } catch {
    return null;
  }
}

// ============================================================
//   Вспомогательные функции
// ============================================================

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };
    img.src = url;
  });
}

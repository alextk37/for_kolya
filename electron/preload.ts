import { contextBridge, ipcRenderer } from 'electron'

// Безопасный мост между main-процессом и renderer-процессом.
// Только минимально необходимый API.
contextBridge.exposeInMainWorld('electronAPI', {
  /** Платформа ОС: 'darwin' | 'linux' | 'win32' */
  platform: process.platform,
  /** Флаг работы внутри Electron */
  isElectron: true,

  // --- IPC для обработки закрытия окна ---

  /** Слушатель запроса от main-процесса о несохранённых данных */
  onCheckUnsaved: (callback: () => void) => {
    ipcRenderer.on('check-unsaved', () => callback())
  },

  /** Разрешить закрытие окна (несохранённых данных нет) */
  closeAllowed: () => {
    ipcRenderer.send('close-allowed')
  },

  /** Запретить закрытие окна (есть несохранённые данные, пользователь отменил) */
  closeDenied: () => {
    ipcRenderer.send('close-denied')
  },

  // --- IPC для сохранения файлов ---

  /** Показать диалог сохранения файла и записать данные.
   *  Возвращает true если файл сохранён, false если пользователь отменил. */
  saveFileDialog: (options: {
    fileName: string
    data: ArrayBuffer
    filters?: { name: string; extensions: string[] }[]
  }): Promise<boolean> => {
    return ipcRenderer.invoke('save-file-dialog', options)
  },
})

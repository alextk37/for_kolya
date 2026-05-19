/**
 * Типы для window.electronAPI — мост между Electron main и renderer.
 * Доступно только при запуске в Electron (window.electronAPI?.isElectron === true).
 */
export {}

declare global {
  interface Window {
    electronAPI?: {
      /** Платформа ОС: 'darwin' | 'linux' | 'win32' */
      platform: string
      /** Флаг работы внутри Electron */
      isElectron: boolean
      /** Слушатель запроса от main-процесса о несохранённых данных */
      onCheckUnsaved: (callback: () => void) => void
      /** Разрешить закрытие окна (несохранённых данных нет) */
      closeAllowed: () => void
      /** Запретить закрытие окна (есть несохранённые данные, пользователь отменил) */
      closeDenied: () => void
      /** Показать диалог сохранения файла и записать данные */
      saveFileDialog: (options: {
        fileName: string
        data: ArrayBuffer
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<boolean>
    }
  }
}

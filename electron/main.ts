import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'

// __dirname доступен в runtime, т.к. vite-plugin-electron компилирует в CJS
declare const __dirname: string

// ============================================================
//   Фикс для AppImage: IndexedDB не работает в песочнице
//   "Internal error opening backing store for indexedDB.open"
//
//   Причины:
//   1. Песочница Chromium блокирует доступ к файловой системе
//   2. Имя приложения "Для Коли" (кириллица) создаёт путь userData
//      с не-ASCII символами, что ломает LevelDB (backing store IndexedDB)
//
//   Решение:
//   - Установить ASCII-имя приложения → userData = ~/.config/for-kolya/
//   - Отключить sandbox через appendSwitch + appendArgument
// ============================================================

// Устанавливаем ASCII-имя приложения ДО app.whenReady()
// Это гарантирует, что userData = ~/.config/for-kolya/ (без кириллицы)
// LevelDB (backing store IndexedDB) не работает с не-ASCII путями
app.setName('for-kolya')

// Явно задаём путь userData на основе нового имени
// app.getPath('userData') вычисляется на основе app.getName()
const userDataPath = join(app.getPath('appData'), 'for-kolya')
app.setPath('userData', userDataPath)

// Флаги отключения песочницы — ТОЛЬКО для Linux (AppImage)
// На macOS эти флаги могут вызывать краш при запуске
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('disable-software-rasterizer')
  // appendArgument — более надёжный способ передать флаг в AppImage,
  // т.к. appendSwitch может не примениться к дочерним процессам
  app.commandLine.appendArgument('--no-sandbox')
}

let mainWindow: BrowserWindow | null = null
let closePending = false

// ============================================================
//   Обработка необработанных исключений (стабильность)
// ============================================================

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error)
  // Не завершаем процесс — показываем диалог
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox(
      'Непредвиденная ошибка',
      `Произошла ошибка: ${error.message}\n\nПриложение продолжит работу, но может быть нестабильным.`
    )
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason)
})

// ============================================================
//   IPC: обработка закрытия окна с несохранёнными данными
// ============================================================

ipcMain.on('close-allowed', () => {
  closePending = false
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
})

ipcMain.on('close-denied', () => {
  closePending = false
  // Пользователь отменил закрытие — ничего не делаем
})

// ============================================================
//   IPC: диалог сохранения файла
// ============================================================

ipcMain.handle('save-file-dialog', async (_event, options: {
  fileName: string
  data: ArrayBuffer
  filters?: { name: string; extensions: string[] }[]
}) => {
  try {
    const filters = options.filters || [
      { name: 'Все файлы', extensions: ['*'] },
    ]
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: options.fileName,
      filters,
    })

    if (result.canceled || !result.filePath) return false

    const buffer = Buffer.from(options.data)
    await writeFile(result.filePath, buffer)
    return true
  } catch (err) {
    console.error('[Main] save-file-dialog error:', err)
    return false
  }
})

// ============================================================
//   Создание окна
// ============================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Для Коли',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Убираем стандартное меню Electron
  Menu.setApplicationMenu(null)

  // Открытие внешних ссылок в системном браузере
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Предотвращение навигации на внешние URL
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://localhost') || url.startsWith('file://')) return
    event.preventDefault()
    shell.openExternal(url)
  })

  // Обработка закрытия окна — спрашиваем рендерер о несохранённых данных
  mainWindow.on('close', (event) => {
    if (closePending) {
      // Уже ожидаем ответ от рендерера — не даём закрыться повторно
      event.preventDefault()
      return
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      closePending = true
      event.preventDefault()
      // Запрашиваем у рендерера проверку несохранённых данных
      mainWindow.webContents.send('check-unsaved')

      // Таймаут: если рендерер не ответил за 3 секунды — закрываем принудительно
      setTimeout(() => {
        if (closePending && mainWindow && !mainWindow.isDestroyed()) {
          closePending = false
          mainWindow.destroy()
        }
      }, 3000)
    }
  })

  // Загрузка приложения
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Показать окно когда готово (предотвращает белый экран при загрузке)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ============================================================
//   Жизненный цикл приложения
// ============================================================

app.whenReady().then(() => {
  createWindow()

  // macOS: пересоздать окно при клике на док-иконку
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Закрыть приложение когда все окна закрыты (кроме macOS — там приложение
// продолжает работать в доке пока пользователь не выйдет через Cmd+Q)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

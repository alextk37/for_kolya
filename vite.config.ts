import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig(() => {
  // Для Electron-сборки используем относительные пути (file:// protocol)
  // Для веб-сборки (GitHub Pages) — абсолютный basePath
  const isElectron = process.env.ELECTRON === 'true'
  const base = isElectron ? './' : '/for_kolya/'

  const plugins: PluginOption[] = [react()]

  if (isElectron) {
    plugins.push(
      electron([
        {
          // Главный процесс Electron
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                output: {
                  format: 'cjs',
                },
              },
            },
          },
        },
        {
          // Preload-скрипт
          entry: 'electron/preload.ts',
          onstart: ({ reload }: { reload: () => void }) => {
            reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                output: {
                  format: 'cjs',
                },
              },
            },
          },
        },
      ]),
      renderer(),
    )
  }

  return {
    base,
    plugins,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'vendor-react'
            }
            if (id.includes('node_modules/jszip')) {
              return 'vendor-jszip'
            }
            if (id.includes('node_modules/papaparse')) {
              return 'vendor-papaparse'
            }
          },
        },
      },
    },
  }
})

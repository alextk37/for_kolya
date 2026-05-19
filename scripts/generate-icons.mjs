#!/usr/bin/env node

/**
 * Скрипт генерации иконок для Electron-сборки из SVG-исходника.
 *
 * Требования:
 *   - npm install --save-dev electron-icon-builder
 *
 * Использование:
 *   node scripts/generate-icons.mjs
 *
 * Берёт public/favicon.svg → генерирует build/icon.png и build/icon.icns
 */

import { readFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const buildDir = resolve(rootDir, 'build')
const svgPath = resolve(rootDir, 'public/favicon.svg')

if (!existsSync(svgPath)) {
  console.error('❌ Файл public/favicon.svg не найден. Создайте SVG-иконку 1024x1024 и поместите в public/favicon.svg')
  process.exit(1)
}

if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true })
}

console.log(`
📋 Инструкция по созданию иконок для Electron:

1. Установите electron-icon-builder:
   npm install --save-dev electron-icon-builder

2. Запустите генерацию:
   npx electron-icon-builder --input=public/favicon.svg --output=build

3. Или создайте иконки вручную:
   - macOS: build/icon.icns (1024x1024)
   - Linux: build/icon.png  (512x512)

Если иконки отсутствуют, electron-builder использует стандартную иконку Electron.
`)

// Проверяем наличие сгенерированных иконок
const icnsPath = resolve(buildDir, 'icon.icns')
const pngPath = resolve(buildDir, 'icon.png')

if (existsSync(icnsPath) && existsSync(pngPath)) {
  console.log('✅ Иконки найдены:')
  console.log(`   macOS: ${icnsPath}`)
  console.log(`   Linux: ${pngPath}`)
} else {
  console.log('⚠️  Иконки не найдены. Будут использованы стандартные иконки Electron.')
  console.log('   Для кастомных иконок выполните инструкции выше.')
}

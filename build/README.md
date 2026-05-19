# Иконки для Electron-сборки

Эта директория содержит иконки приложения для десктоп-сборки.

## Требуемые файлы

| Файл | Платформа | Размер | Описание |
|------|-----------|--------|----------|
| `icon.icns` | macOS | 1024×1024 | Иконка в формате Apple ICNS |
| `icon.png` | Linux | 512×512 | Иконка в формате PNG |

## Как сгенерировать иконки

### Способ 1: electron-icon-builder (рекомендуется)

```bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=public/favicon.svg --output=build
```

### Способ 2: Вручную

1. Создайте SVG-иконку размером 1024×1024 в `public/favicon.svg`
2. Конвертируйте в нужные форматы:
   - **macOS**: `iconutil` или онлайн-конвертер SVG → ICNS
   - **Linux**: `convert favicon.svg -resize 512x512 build/icon.png` (ImageMagick)

### Способ 3: Онлайн-сервисы

- [electron-icon-maker](https://www.electronjs.org/docs/latest/api/app#appseticonnativeimageimage-linux-macos)
- [CloudConvert](https://cloudconvert.com/svg-to-icns)
- [PNG to ICNS](https://iconverticons.com/online/)

Если иконки отсутствуют, `electron-builder` использует стандартную иконку Electron.

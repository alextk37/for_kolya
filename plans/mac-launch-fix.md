# Анализ: Почему приложение не запускается на macOS M1

## Симптомы

1. **Приложение "повреждено"** — macOS показывает диалог: *"Для Коли.app повреждён и не может быть открыт. Следует переместить его в корзину"*
2. **Gatekeeper блокирует** — *"Не удалось открыть Для Коли, так как его автор не может быть подтверждён"*
3. **Краш при запуске** — приложение появляется в доке и сразу исчезает
4. **Белый экран** — окно открывается, но содержимое не загружается
5. **IndexedDB не работает** — данные не сохраняются между сессиями

---

## Корневые причины

### 🔴 Критическая #1: hardenedRuntime: false + отсутствие код-подписи

**Файл:** [`package.json`](package.json:65)

```json
"hardenedRuntime": false
```

macOS Gatekeeper **блокирует** неподписанные приложения с `hardenedRuntime: false`. На macOS 12+ (Monterey и новее) это приводит к сообщению "приложение повреждено".

**Решение:**
- `hardenedRuntime: true` — включает Hardened Runtime (требуется для Gatekeeper)
- Ad-hoc подпись через `codesign --sign - --force --deep` — позволяет приложению пройти базовую проверку
- Удаление quarantine-атрибута через `xattr -cr` — убирает флаг "скачано из интернета"

---

### 🔴 Критическая #2: Только zip-таргет — потеря код-подписи при распаковке

**Файл:** [`package.json`](package.json:67)

```json
"target": [{ "target": "zip", "arch": ["arm64"] }]
```

При распаковке zip-архива на macOS:
- Теряются расширенные атрибуты (xattr), включая код-подпись
- Quarantine-флаг накладывается на все файлы
- Приложение не может пройти верификацию код-подписи

**Решение:**
- Добавить `dmg` таргет — DMG сохраняет код-подпись и расширенные атрибуты
- DMG — стандартный формат распространения macOS-приложений

---

### 🔴 Критическая #3: Отсутствие com.apple.security.app-sandbox в entitlements

**Файл:** [`build/entitlements.mac.plist`](build/entitlements.mac.plist)

Без явного `com.apple.security.app-sandbox = false` macOS может попытаться запустить приложение в sandbox-режиме, что приведёт к крашу, т.к. приложение не подписано Apple Developer ID.

**Решение:**
```xml
<key>com.apple.security.app-sandbox</key>
<false/>
```

---

### 🟡 Средняя #4: Нет NSHighResolutionCapable — Retina-проблемы

Без `NSHighResolutionCapable = true` в Info.plist приложение на Retina-дисплее M1 запускается в low-resolution режиме (размытый интерфейс).

**Решение:**
```json
"extendInfo": {
  "NSHighResolutionCapable": true,
  "LSMinimumSystemVersion": "12.0.0"
}
```

---

### 🟡 Средняя #5: Нет single-instance lock — дублирование процессов

На macOS клик на док-иконку при уже запущенном приложении создаёт второй процесс вместо фокусировки существующего окна.

**Решение:**
```typescript
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) { app.quit() }
app.on('second-instance', () => { mainWindow.focus() })
```

---

### 🟡 Средняя #6: Нет mkdir для userData — IndexedDB молча падает

Если директория `~/Library/Application Support/for-kolya/` не существует к моменту первого обращения IndexedDB, Chrome создаёт её с неправильными правами или молча падает.

**Решение:**
```typescript
if (!existsSync(userDataPath)) {
  mkdir(userDataPath, { recursive: true })
}
```

---

### 🟡 Средняя #7: GPU краш на Apple Silicon

На некоторых конфигурациях M1/M2/M3 Electron крашится из-за проблем с ANGLE GPU процессом. Это особенно проявляется при `hardenedRuntime: true`.

**Решение:**
```typescript
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'metal')
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}
```

---

## Внесённые изменения

| Файл | Изменение | Проблема |
|---|---|---|
| [`package.json`](package.json) | `hardenedRuntime: true` | Gatekeeper блокирует |
| [`package.json`](package.json) | Добавлен `dmg` target | Zip теряет код-подпись |
| [`package.json`](package.json) | `asar: true` | Оптимизация загрузки |
| [`package.json`](package.json) | `extendInfo` с NSHighResolutionCapable | Retina-режим |
| [`package.json`](package.json) | `notarize: false` | Нет Apple Developer ID |
| [`package.json`](package.json) | `dmg` секция | Корректный DMG-установщик |
| [`electron/main.ts`](electron/main.ts) | `requestSingleInstanceLock()` | Дублирование процессов |
| [`electron/main.ts`](electron/main.ts) | `mkdir(userDataPath)` | IndexedDB падает |
| [`electron/main.ts`](electron/main.ts) | `use-angle: metal` + `disable-gpu-sandbox` | GPU краш на M1 |
| [`electron/main.ts`](electron/main.ts) | `second-instance` handler | Фокус окна |
| [`electron/main.ts`](electron/main.ts) | `app.whenReady().catch()` | Обработка ошибок запуска |
| [`build/entitlements.mac.plist`](build/entitlements.mac.plist) | `app-sandbox: false` | Sandbox краш |
| [`build/entitlements.mac.plist`](build/entitlements.mac.plist) | `files.user-selected.read-write` | Диалоги сохранения |
| [`scripts/mac-postbuild.sh`](scripts/mac-postbuild.sh) | Ad-hoc подпись + quarantine | Gatekeeper блокирует |

---

## Инструкция: Как гарантированно запустить на macOS M1

### Способ 1: Сборка на macOS (рекомендуется — полный пакет)

```bash
# На macOS — собирает .app + DMG + zip
make electron-build-mac
./scripts/mac-postbuild.sh
```

Скрипт `mac-postbuild.sh` автоматически:
1. Найдёт `.app` в `release/`
2. Наложит ad-hoc подпись (`codesign --sign -`)
3. Удалит quarantine-атрибут (`xattr -cr`)
4. Проверит архитектуру (arm64)

### Способ 2: Сборка на Linux (кросс-компиляция)

```bash
# На Linux — собирает .app + zip (DMG недоступен, нужен hdiutil из macOS)
npm run electron:build:mac
```

Результат в `release/mac-arm64/Для Коли.app` — готов к переносу на Mac.

⚠️ **Важно:** При переносе .app с Linux на macOS нужно выполнить на Mac:
```bash
xattr -cr "/path/to/Для Коли.app"
codesign --sign - --force --deep "/path/to/Для Коли.app"
```

### Способ 3: Ручная сборка

```bash
npm run electron:build:mac
./scripts/mac-postbuild.sh
```

### Способ 3: Если приложение всё ещё не открывается

1. **Системные настройки** → Конфиденциальность и защита
2. Прокрутите вниз → "Приложения, загруженные не из App Store"
3. Нажмите "Разрешить" рядом с приложением

Или через терминал:
```bash
xattr -cr "/path/to/Для Коли.app"
```

### Способ 4: Отключение Gatekeeper (не рекомендуется для продакшена)

```bash
spctl --master-disable
```

⚠️ Это отключает Gatekeeper для ВСЕХ приложений. Используйте только для разработки.

---

## Чеклист перед релизом на macOS

- [ ] `hardenedRuntime: true` в package.json
- [ ] `com.apple.security.app-sandbox: false` в entitlements
- [ ] DMG-таргет в дополнение к zip
- [ ] Ad-hoc подпись после сборки (`codesign --sign - --force --deep`)
- [ ] Удаление quarantine (`xattr -cr`)
- [ ] `NSHighResolutionCapable: true` в Info.plist
- [ ] `requestSingleInstanceLock()` в main.ts
- [ ] `mkdir` для userData перед первым запуском
- [ ] `use-angle: metal` для Apple Silicon GPU
- [ ] Тест на чистой macOS M1 (без Rosetta)

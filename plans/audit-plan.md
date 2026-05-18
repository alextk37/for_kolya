# Полный аудит приложения «Для Коли» — План проверок и исправлений

## Обзор проекта

Приложение — генератор изображений с подстановкой текста из CSV-данных.  
Стек: React 19 + TypeScript + Vite 8, без роутинга, без state-менеджера.  
Деплой: GitHub Pages (`/for_kolya/`).

---

## 🔴 КРИТИЧЕСКИЕ БАГИ

### 1. Отсутствие touch-событий — неработоспособность на мобильных

**Файлы:** [`CanvasEditor.tsx`](src/components/CanvasEditor.tsx:69), [`TextLayerComponent.tsx`](src/components/TextLayerComponent.tsx:102)

Перетаскивание и ресайз слоёв реализованы только через `onMouseMove`/`onMouseUp`/`onMouseDown`. На мобильных устройствах (Android, iOS) эти события не срабатывают.

**Решение:**
- Добавить обработку `onTouchStart`, `onTouchMove`, `onTouchEnd`
- В `CanvasEditor` — добавить `onTouchMove`/`onTouchEnd` на контейнер
- В `TextLayerComponent` — добавить `onTouchStart` на слой и на resize-ручки
- Извлекать `clientX`/`clientY` из `e.touches[0]` / `e.changedTouches[0]`
- Добавить `e.preventDefault()` для предотвращения скролла при перетаскивании
- Добавить `touch-action: none` CSS на перетаскиваемые элементы

---

### 2. Некорректная санитизация EAN-13 — генерация неверных штрихкодов

**Файл:** [`drawBarcode.ts`](src/utils/drawBarcode.ts:7)

Функция `sanitizeEan13` дополняет короткие значения нулями слева: `"7693732"` → `"00000007693732"`. Это создаёт **невалидный** EAN-13, потому что 13-я цифра — контрольная сумма, а не просто ноль. JsBarcode при этом выбрасывает ошибку или генерирует некорректный штрихкод.

**Решение:**
- Если цифр < 12 — не пытаться сгенерировать EAN-13, показать ошибку
- Если цифр = 12 — вычислить контрольную сумму (13-ю цифру) по алгоритму EAN-13
- Если цифр = 13 — проверить контрольную сумму, при невалидной — показать ошибку
- Если цифр > 13 — обрезать до 13 и проверить

---

### 3. Утечки памяти — Object URLs не освобождаются

**Файлы:** [`useAppState.ts`](src/hooks/useAppState.ts:40), [`App.tsx`](src/App.tsx:42), [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:153)

- `handleImageLoad` создаёт `URL.createObjectURL(file)`, но при повторной загрузке изображения старый URL не ревокается (ревокается только в `resetAll`)
- `handleSelectProject` в `App.tsx` создаёт `URL.createObjectURL(record.imageBlob)`, который никогда не ревокается
- `ImageGenerator` создаёт URL для каждого сгенерированного изображения и для ZIP-архива, но URL изображений не ревокаются при повторной генерации или при уходе со страницы
- `loadFromProject` в `useAppState` не ревокает предыдущий `imageUrl`

**Решение:**
- В `handleImageLoad` — перед созданием нового URL ревокать старый
- В `handleSelectProject` — ревокать URL при уходе с экрана проекта
- В `ImageGenerator` — добавить кнопку/логику очистки URL при повторной генерации
- В `loadFromProject` — ревокать предыдущий `imageUrl`
- Добавить `useEffect` cleanup при размонтировании компонентов

---

### 4. `prompt()` для редактирования слоёв — не работает на мобильных и в некоторых браузерах

**Файл:** [`TextLayerComponent.tsx`](src/components/TextLayerComponent.tsx:122)

Используется `window.prompt()` для изменения свойств слоя при двойном клике. Это:
- Блокируется некоторыми браузерами/расширениями
- Не работает на мобильных Safari
- Не доступно для screen reader'ов
- Плохой UX

**Решение:**
- Удалить `prompt()` — все настройки уже есть в панели свойств `LayerPanel`
- Либо заменить на inline-редактирование прямо на слое

---

## 🟠 СЕРЬЁЗНЫЕ ПРОБЛЕМЫ СОВМЕСТИМОСТИ

### 5. CSS `:has()` — не поддерживается в Firefox < 121

**Файл:** [`index.css`](src/index.css:1894)

```css
.modal__radio:has(input:checked) {
  border-color: var(--gold);
  background: var(--gold-glow);
}
```

Firefox поддерживает `:has()` только с версии 121 (декабрь 2023). Пользователи старых версий не увидят подсветку выбранного радио.

**Решение:**
- Добавить JS-обработку: при изменении радио добавлять/удалять класс на `.modal__radio`
- Или использовать `input:checked + span` структуру вместо `:has()`

---

### 6. CSS `inset: 0` — не поддерживается в старых браузерах

**Файл:** [`index.css`](src/index.css:453) (и другие места)

`inset` — это shorthand для `top/right/bottom/left`. Не поддерживается в Firefox < 66, Safari < 14.1, Chrome < 87.

**Решение:**
- Заменить `inset: 0` на `top: 0; right: 0; bottom: 0; left: 0;`

---

### 7. CSS `backdrop-filter` — пропущен `-webkit-` префикс в модалке

**Файл:** [`index.css`](src/index.css:1739)

```css
.modal-overlay {
  backdrop-filter: blur(4px);
  /* Отсутствует -webkit-backdrop-filter! */
}
```

В остальных местах (header, sidebar) префикс есть, а в модалке — нет. Safari требует `-webkit-` префикс.

**Решение:**
- Добавить `-webkit-backdrop-filter: blur(4px);` перед `backdrop-filter`

---

### 8. `::-webkit-color-swatch` — нет стилей для Firefox

**Файл:** [`index.css`](src/index.css:866)

Стили для `input[type=color]` используют только `::-webkit-color-swatch-wrapper` и `::-webkit-color-swatch`. Firefox использует `::-moz-color-swatch`.

**Решение:**
- Добавить:
```css
.prop-group input[type='color']::-moz-color-swatch {
  border: none;
  border-radius: 3px;
}
```

---

### 9. Скачивание файлов через `a.click()` — проблемы в Firefox/Safari

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:182)

```js
const a = document.createElement('a');
a.href = zipUrl;
a.download = 'generated-images.zip';
a.click();  // Элемент не добавлен в DOM!
```

Firefox может блокировать клик по элементу, не добавленному в DOM. Safari может игнорировать `download` атрибут.

**Решение:**
- Добавлять `<a>` в `document.body` перед кликом
- Удалять после клика
- В `projectStorage.ts` `downloadProjectAsZip` это уже сделано правильно (строка 521-523)

---

### 10. `imageSmoothingQuality: 'high'` — не поддерживается в Safari

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:51)

Safari поддерживает `imageSmoothingEnabled`, но не `imageSmoothingQuality`. Ошибки не будет, но сглаживание будет среднего качества.

**Решение:**
- Это некритично, но стоит добавить комментарий
- Можно проверить поддержку и установить только если доступно

---

### 11. File System Access API — запрос прав при листинге проектов

**Файл:** [`projectStorage.ts`](src/utils/projectStorage.ts:225)

`listProjectsFSA()` вызывает `getOrRequestRootHandle()`, который запрашивает разрешение. Это значит, что при открытии приложения пользователь может получить диалог выбора папки, что является плохим UX.

**Решение:**
- Разделить `listProjects` на два шага: сначала попробовать получить handle без запроса прав, затем — только по действию пользователя
- Сохранять результат `queryPermission` и показывать проекты только если разрешение уже дано
- Если разрешение не дано — показывать пустой список с кнопкой «Предоставить доступ»

---

## 🟡 ПРОБЛЕМЫ СРЕДНЕЙ СЕРЬЁЗНОСТИ

### 12. CSV-парсер — проблемы с кодировкой

**Файл:** [`csvParser.ts`](src/utils/csvParser.ts:4)

PapaParse по умолчанию использует UTF-8. CSV-файлы из Excel на Windows часто сохраняются в Windows-1251. Это приведёт к кракозябрам для русских данных.

**Решение:**
- Добавить опцию `encoding: 'UTF-8'` явно
- Или реализовать автоопределение кодировки (BOM-маркер / частотный анализ)
- Или добавить в UI выбор кодировки при загрузке CSV

---

### 13. CSV-парсер — строки с разным количеством колонок

**Файл:** [`csvParser.ts`](src/utils/csvParser.ts:11)

Если CSV содержит строки с количеством ячеек, отличным от заголовков, `layer.columnIndex` может указывать на `undefined` значение в `row[layer.columnIndex]`.

**Решение:**
- Добавить валидацию: предупреждать если строки имеют разное количество колонок
- Или дополнять короткие строки пустыми ячейками

---

### 14. `Math.max(...array)` — потенциальный Stack Overflow

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:356)

```js
const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
```

Если `lines` содержит тысячи элементов, spread-оператор превысит размер стека вызовов.

**Решение:**
- Заменить на `reduce`:
```js
const maxW = lines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);
```

---

### 15. `parseInt()` без указания системы счисления

**Файлы:** [`LayerPanel.tsx`](src/components/LayerPanel.tsx:68), [`TextLayerComponent.tsx`](src/components/TextLayerComponent.tsx:125), [`useAppState.ts`](src/hooks/useAppState.ts:61)

Множественные вызовы `parseInt(e.target.value)` без второго аргумента `10`. Хотя современные браузеры по умолчанию используют десятиччную систему, это плохая практика.

**Решение:**
- Заменить все `parseInt(x)` на `parseInt(x, 10)`
- Или использовать `Number(x)` / `parseFloat` где уместно

---

### 16. `canvas.getContext('2d')!` — non-null assertion

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:48), [`projectStorage.ts`](src/utils/projectStorage.ts:428)

Использование `!` для утверждения, что контекст не null. В редких случаях (например, при отключённом GPU) контекст может быть null.

**Решение:**
- Добавить проверку:
```js
const ctx = canvas.getContext('2d');
if (!ctx) { /* обработка ошибки */ return; }
```

---

### 17. Отсутствие отмены генерации изображений

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:35)

Если CSV содержит 1000+ строк, генерация может занять значительное время. Нет механизма отмены.

**Решение:**
- Добавить `AbortController` или флаг `cancelled`
- Добавить кнопку «Отменить»
- Проверять флаг в цикле генерации

---

### 18. Все сгенерированные blob'ы хранятся в памяти

**Файл:** [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:33)

`blobCache.current` хранит все сгенерированные Blob'ы. Для 1000 изображений по 500 КБ это ~500 МБ оперативной памяти.

**Решение:**
- Ограничить кэш последними N изображениями
- Или хранить только URL, а blob'ы получать по требованию
- Или генерировать ZIP на лету без хранения всех blob'ов

---

### 19. IndexedDB может быть недоступна

**Файл:** [`projectStorage.ts`](src/utils/projectStorage.ts:50)

В режиме приватного просмотра в некоторых браузерах (старый Safari, Firefox) IndexedDB может быть недоступна или иметь квоту 0.

**Решение:**
- Обернуть все операции IndexedDB в try/catch (частично сделано)
- Показывать пользователю понятную ошибку при недоступности хранилища

---

### 20. `crossOrigin = 'anonymous'` на blob URL

**Файлы:** [`useAppState.ts`](src/hooks/useAppState.ts:44), [`ImageGenerator.tsx`](src/components/ImageGenerator.tsx:293)

Установка `crossOrigin = 'anonymous'` на изображение с blob URL не нужна и может вызывать проблемы в некоторых браузерах (Яндекс Браузер, старый Edge).

**Решение:**
- Устанавливать `crossOrigin` только для внешних URL
- Для blob URL и data URL — не устанавливать

---

## 🔵 ПРОБЛЕМЫ ДОСТУПНОСТИ (ACCESSIBILITY)

### 21. Модальные окна — нет focus trap

**Файлы:** [`Modal.tsx`](src/components/Modal.tsx:52), [`SaveProjectModal.tsx`](src/components/SaveProjectModal.tsx:78)

При открытом модальном окне пользователь может Tab'ом перейти к элементам за модалкой. Это нарушает WCAG 2.1.

**Решение:**
- Реализовать focus trap: перехватывать Tab/Shift+Tab и циклически перемещать фокус внутри модалки
- Или использовать библиотеку (например, `focus-trap-react`)

---

### 22. Модальные окна — отсутствуют ARIA-атрибуты

**Файлы:** [`Modal.tsx`](src/components/Modal.tsx:52), [`SaveProjectModal.tsx`](src/components/SaveProjectModal.tsx:78)

Нет `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.

**Решение:**
- Добавить `role="dialog"`, `aria-modal="true"`, `aria-labelledby` на `.modal`
- Связать `aria-labelledby` с заголовком через `id`

---

### 23. Кнопки удаления/экспорта в ProjectSelector — не доступны с клавиатуры

**Файл:** [`ProjectSelector.tsx`](src/components/ProjectSelector.tsx:201)

Кнопки удаления и экспорта внутри карточки проекта не имеют `tabIndex` и не доступны при навигации с клавиатуры.

**Решение:**
- Добавить `tabIndex={0}` и обработку `onKeyDown` для кнопок действий

---

### 24. Низкий контраст текста

**Файл:** [`index.css`](src/index.css:23)

`--text-tertiary: rgba(240, 237, 232, 0.3)` на тёмном фоне даёт контраст ~2.5:1, что не проходит WCAG AA (требуется 4.5:1).

**Решение:**
- Увеличить opacity до 0.5–0.55 для tertiary текста
- Или использовать отдельный цвет с достаточным контрастом

---

## ⚪ МЕЛКИЕ УЛУЧШЕНИЯ

### 25. Vite — не указан `build.target`

**Файл:** [`vite.config.ts`](vite.config.ts:5)

Нет явного указания целевых браузеров для сборки. По умолчанию Vite targeting `['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']`.

**Решение:**
- Добавить `build: { target: 'es2020' }` или `targets: 'defaults'`
- Или добавить `browserslist` в `package.json`

---

### 26. Нет `browserslist` в package.json

**Файл:** [`package.json`](package.json:1)

Отсутствует поле `browserslist`, что не позволяет инструментам (autoprefixer, babel, vite) автоматически определять целевые браузеры.

**Решение:**
- Добавить в `package.json`:
```json
"browserslist": [
  "> 0.5%",
  "last 2 versions",
  "not dead",
  "not IE 11"
]
```

---

### 27. `SaveProjectModalWrapper` — антипаттерн с key

**Файл:** [`SaveProjectModal.tsx`](src/components/SaveProjectModal.tsx:187)

```jsx
<SaveProjectModal key={props.open ? 'open' : 'closed'} {...props} />
```

Использование `key` для сброса состояния — это антипаттерн, приводящий к размонтированию/монтированию компонента.

**Решение:**
- Использовать `useEffect` для сброса состояния при открытии

---

### 28. Favicon — потенциальная проблема с base path

**Файл:** [`index.html`](index.html:6)

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

С `base: '/for_kolya/'` в Vite, абсолютный путь `/favicon.svg` может не резолвиться корректно. Vite обычно обрабатывает это, но стоит проверить.

**Решение:**
- Заменить на относительный путь: `href="./favicon.svg"` или `%BASE_URL%favicon.svg`

---

### 29. `eslint-disable-next-line` — избыточное подавление

**Файл:** [`ProjectSelector.tsx`](src/components/ProjectSelector.tsx:40)

`refresh` обёрнут в `useCallback` с пустыми зависимостями, поэтому подавление `react-hooks/exhaustive-deps` не нужно.

**Решение:**
- Удалить комментарий `eslint-disable-next-line`

---

### 30. `doSaveProject` — неэффективное получение Blob

**Файл:** [`App.tsx`](src/App.tsx:88)

```js
const response = await fetch(state.imageUrl);
const imageBlob = await response.blob();
```

Это делает HTTP-запрос по blob URL, чтобы получить Blob, который и так уже есть в памяти. Это работает, но неэффективно.

**Решение:**
- Хранить оригинальный `File`/`Blob` в состоянии вместо/вместе с `imageUrl`
- Или сохранить blob в ref при загрузке изображения

---

## Сводная таблица приоритетов

| # | Проблема | Критичность | Затронутые браузеры |
|---|----------|-------------|---------------------|
| 1 | Touch-события | 🔴 Критическая | Все мобильные |
| 2 | EAN-13 санитизация | 🔴 Критическая | Все |
| 3 | Утечки памяти | 🔴 Критическая | Все |
| 4 | prompt() на мобильных | 🔴 Критическая | Mobile Safari, Firefox |
| 5 | CSS :has() | 🟠 Высокая | Firefox < 121 |
| 6 | CSS inset | 🟠 Высокая | Старые Firefox/Safari |
| 7 | backdrop-filter в модалке | 🟠 Высокая | Safari |
| 8 | ::-moz-color-swatch | 🟠 Высокая | Firefox |
| 9 | a.click() без DOM | 🟠 Высокая | Firefox, Safari |
| 10 | imageSmoothingQuality | 🟡 Средняя | Safari |
| 11 | FSA permission on list | 🟠 Высокая | Chrome/Edge |
| 12 | CSV кодировка | 🟡 Средняя | Все (Windows) |
| 13 | CSV разная длина строк | 🟡 Средняя | Все |
| 14 | Math.max spread | 🟡 Средняя | Все |
| 15 | parseInt без radix | 🟡 Средняя | Все |
| 16 | getContext non-null | 🟡 Средняя | Все |
| 17 | Нет отмены генерации | 🟡 Средняя | Все |
| 18 | Память blobCache | 🟡 Средняя | Все |
| 19 | IndexedDB недоступна | 🟡 Средняя | Private browsing |
| 20 | crossOrigin на blob | 🟡 Средняя | Яндекс, старый Edge |
| 21 | Focus trap в модалках | 🔵 Низкая | Все |
| 22 | ARIA атрибуты | 🔵 Низкая | Все |
| 23 | Клавиатурная навигация | 🔵 Низкая | Все |
| 24 | Низкий контраст | 🔵 Низкая | Все |
| 25 | Vite build target | ⚪ Минимальная | Старые браузеры |
| 26 | browserslist | ⚪ Минимальная | — |
| 27 | key антипаттерн | ⚪ Минимальная | — |
| 28 | Favicon base path | ⚪ Минимальная | — |
| 29 | eslint-disable | ⚪ Минимальная | — |
| 30 | Blob через fetch | ⚪ Минимальная | — |

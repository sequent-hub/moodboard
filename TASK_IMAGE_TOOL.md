# Задача: E2E-тесты и покрытие для инструмента «Добавить картинку»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст» и «Записка». См. `tests/image-object2/TextTool.e2e.spec.js`, `tests/image-object2/NoteTool.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для всех способов добавления картинки на доску, трансформаций и призрака; проверить/доработать undo/redo; обновить документацию.

---

## Исключено из scope

На панели инструментов есть **две** кнопки «Добавить картинку»:

- **Основная кнопка** (`id: 'image'`, `type: 'image-add'`, класс `.moodboard-toolbar__button--image`) — открывает `openImageDialog()`, эмитит `Place.ImageSelected` / `Place.ImageCanceled`. **Это scope задачи.**
- **Кнопка image2** (`id: 'image2'`, `type: 'image2-add'`, класс `.moodboard-toolbar__button--image2`) — добавлена для тестов, использует параллельную цепочку (`openImageObject2Dialog()`, `Place.ImageObject2Selected`, `PlacementToolV2` и т.д.). **Всё, что связано с image2, в scope не входит.**

Тесты и изменения для кнопки image2 не требуются.

---

## Действия (scope)

### Способы добавления картинки

1. **Через панель инструментов** — основная кнопка «Добавить картинку» (`.moodboard-toolbar__button--image`, `image-add`) открывает file chooser; после выбора файла появляется призрак; клик на холст размещает картинку.
2. **Через Ctrl+V** — вставка из буфера обмена (clipboard image) размещает картинку в центре экрана или под курсором. Цепочка: `KeyboardClipboardImagePaste` → `Events.UI.PasteImage` → `ClipboardFlow` → `core.createObject('image', ...)`.
3. **Перетаскивание с устройства** — drop файла(ов) с изображением на область moodboard. `ToolManager.handleDrop` → `Events.UI.PasteImageAt` с координатами места drop.
4. **Перетаскивание из браузера** — drag картинки со страницы (URL или data URL) на moodboard. `ToolEventRouter.handleDrop` читает `dataTransfer` (text/html с img src, или URL).

### Трансформации картинки на холсте

5. **Перемещение** — drag объектом по холсту (`MoveObjectCommand`, `TransformFlow`).
6. **Масштабирование** — ресайз ручками (`ResizeObjectCommand`, `HtmlHandlesLayer`).
7. **Вращение** — ручка поворота (`RotateObjectCommand`).

### Призрак (ghost)

8. **При перетаскивании** — во время drag объекта по холсту отображается призрак (если реализовано; уточнить в `TransformInteractionController` / `SimpleDragController`).
9. **При выборе из панели инструментов** — после клика по основной кнопке «Добавить картинку» и выбора файла появляется призрак, следующий за курсором до клика для размещения. Реализовано в `GhostController.showImageGhost`, `PlacementInputRouter.onMouseMove`.

---

## Референс: что уже есть для картинки

### Существующие тесты и потоки

- **`tests/image-object2/Toolbar.image-object2-button.e2e.spec.js`** — тестирует кнопку **image2** (вне scope). Не использовать как референс для основной кнопки.
- **`tests/tools/ToolManager.image-drop.test.js`** — unit: drop image file → PasteImageAt с server URL / fallback data URL.
- **`tests/core/KeyboardManager.image-upload.test.js`** — unit: вставка через клавиатуру (success + fallback data URL).
- **`tests/tools/PlacementTool.baseline.ghost.test.js`** — unit: ghost show/hide/update для note, shape, frame (не для image).
- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke по типам объектов (в т.ч. image): создание через API, выделение, удаление, copy/paste, layer операции.

### Ключевые файлы (основная кнопка image-add)

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar image | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarDialogsController.js` | Кнопка image (image-add), `openImageDialog()`, `Place.ImageSelected` / `Place.ImageCanceled` |
| Ghost | `GhostController.js` | `showImageGhost` (при `Place.ImageSelected`), `showImageUrlGhost`, `showFileGhost` |
| Placement | `PlacementTool.js`, `PlacementEventsBridge.js`, `PlacementInputRouter.js` | Размещение, призрак при выборе из панели (PlacementToolV2 — для image2, вне scope) |
| Paste | `KeyboardClipboardImagePaste.js` | Ctrl+V → PasteImage |
| Drop | `ToolManager.js`, `ToolEventRouter.js` | drop файлов и HTML-картинок из браузера |
| ClipboardFlow | `ClipboardFlow.js` | Обработка PasteImage, PasteImageAt → createObject |
| Transform | `TransformFlow.js`, `HtmlHandlesLayer.js` | Move, Resize, Rotate |
| Объект | `ImageObject.js`, `ObjectFactory.js` | type: 'image' |

### События (основная кнопка)

- `Place.ImageSelected` — выбран файл изображения (основная кнопка, `openImageDialog`).
- `Place.ImageCanceled` — отмена выбора изображения.
- `Place.FileSelected` — выбран файл (для вложений/file-объектов, не для image).
- `Events.UI.PasteImage` — вставка (центр/курсор).
- `Events.UI.PasteImageAt` — вставка в координаты (drop, контекстное меню).

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/ImageTool.e2e.spec.js` по аналогии с `NoteTool.e2e.spec.js`:

- **Добавление через панель** — клик по основной кнопке `.moodboard-toolbar__button--image`, выбор тестового файла (например, через `page.setInputFiles` или mock), ожидание призрака, клик на холст, проверка появления объекта image.
- **Добавление через Ctrl+V** — фокус на moodboard, эмуляция paste с image в clipboard (Playwright `page.evaluate` + `navigator.clipboard` или mock clipboardData), проверка появления image.
- **Добавление перетаскиванием с устройства** — создание File с изображением, drop на canvas, проверка появления image.
- **Добавление перетаскиванием из браузера** — drag URL картинки или data URL (если возможно в E2E), drop на moodboard, проверка.
- **Перемещение** — создать image через API, выделить, перетащить, проверить изменение position.
- **Масштабирование** — ресайз ручками, проверка width/height.
- **Вращение** — поворот ручкой, проверка transform.rotation.
- **Призрак при выборе из панели** — после выбора файла проверить наличие ghost (например, PIXI-контейнер в world с alpha 0.6 или соответствующий DOM/CSS).
- **Призрак при перетаскивании** — уточнить, есть ли визуальный призрак во время drag; если да — тест; если нет — зафиксировать в документации.

Использовать страницу `/test-moodboard.html` и хелперы по образцу TextTool/NoteTool: `createObject`, `getObjectById`, `getObjectCanvasCenter`, `setSelection`, `triggerUndo`, `triggerRedo`.

### 2. Unit-тесты для ghost и placement

- **Ghost для image** — в `PlacementTool.baseline.ghost.test.js` или отдельном файле: `Place.ImageSelected` → `showImageGhost` → ghost добавлен в world, `updateGhostPosition` обновляет координаты. Учесть асинхронность `showImageGhost` (PIXI.Texture.fromURL).
- **Placement при drop** — покрытие `ToolEventRouter.handleDrop` для image files и drag-from-browser (text/html с img src) — уже частично в `ToolManager.image-drop.test.js`; при необходимости расширить или выделить отдельные кейсы.

### 3. Undo/Redo для картинки

- **AddObjectCommand** — добавление картинки (любым способом) уже должно попадать в историю через `ObjectLifecycleFlow` / `AddObjectCommand`. Проверить, что undo удаляет добавленную картинку, redo восстанавливает.
- **MoveObjectCommand, ResizeObjectCommand, RotateObjectCommand** — для image должны работать как для text/note. Добавить E2E-тесты undo/redo: перемещение, ресайз, поворот.
- **DeleteObjectCommand** — undo удаления восстанавливает картинку. Smoke уже в SelectTool.types-smoke.

### 4. Документация

- Обновить `TESTS.md`: секция `ImageTool.e2e.spec.js` (что покрыто, какие сценарии).
- Краткие комментарии к describe/test в E2E-файле.

---

## Важные отличия картинки от записки/текста

| Аспект | Текст / Записка | Картинка |
|--------|-----------------|----------|
| Добавление | PlacementTool + Place.Set (type: note/text) | Основная кнопка: file chooser → Place.ImageSelected; paste/drop → PasteImage/PasteImageAt |
| Призрак | showNoteGhost / showTextGhost (Place.Set) | showImageGhost (Place.ImageSelected), showImageUrlGhost (Place.Set type: image) |
| Панель свойств | NotePropertiesPanel, TextPropertiesPanel | Нет отдельной панели (или общая для image — уточнить) |
| Хранение | properties.content, properties.fontSize и т.д. | src, width, height |
| Кнопка тулбара | note, text-add | `.moodboard-toolbar__button--image` (image-add) |

---

## Особенности E2E для картинки

- **Файл для тестов** — использовать маленькое валидное изображение (base64 data URL или файл в `tests/fixtures/`), чтобы не зависеть от сети и upload-сервиса в E2E.
- **Clipboard paste** — Playwright ограничен в доступе к clipboard. Варианты: (1) `page.evaluate` с mock `paste` event и `clipboardData`; (2) прямой вызов `window.moodboard.coreMoodboard.eventBus.emit(Events.UI.PasteImage, { src: dataUrl, name: 'test.png' })` для изоляции от реального clipboard.
- **Drag from browser** — воспроизведение drag URL может требоваться через `page.dispatchEvent` или `locator.dragTo` с кастомным dataTransfer; проверить возможности Playwright.

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования; 600+ — не расширять без причины.
- Один файл — одна ответственность.
- Новый функционал — отдельный файл.
- Перед крупным рефактором — baseline-тесты.
- Не менять контракты событий без явной необходимости.
- Не выдвигать гипотез — сначала сбор информации, логирование, диагностика.
- Изменять код только после явного разрешения («можно»).

---

## Порядок выполнения

1. Изучить текущие потоки: основная кнопка image (openImageDialog, Place.ImageSelected), paste, drop device, drop browser.
2. Создать `ImageTool.e2e.spec.js` с тестами добавления (toolbar, paste, drop device; drop browser — по возможности).
3. Добавить тесты трансформаций (перемещение, ресайз, поворот) и призрака при выборе из панели.
4. Добавить unit-тесты для ghost image при необходимости.
5. Проверить undo/redo для добавления, перемещения, ресайза, поворота, удаления.
6. Обновить `TESTS.md`.

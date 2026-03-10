# Задача: E2E-тесты инструмента «Добавить файл»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст», «Записка», «Добавить картинку» и «Фигуры». См. `tests/image-object2/ImageTool.e2e.spec.js`, `tests/image-object2/NoteTool.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для инструмента «Добавить файл»: диалог выбора, призрак, размещение, выделение, кнопка «Скачать», рамка/ручки, перемещение и удаление.

---

## Действия (scope)

### 1. Открывается диалоговое окно выбора файла

- Кнопка «Файлы» (`.moodboard-toolbar__button--attachments`, `type: 'custom-attachments'`) при клике вызывает `openFileDialog()`.
- Создаётся `<input type="file" accept="*/*">`, добавляется в DOM, вызывается `input.click()` — открывается нативный диалог выбора файла.

### 2. Отображается призрак файла

- После выбора файла в диалоге эмитируется `Place.FileSelected` с данными файла.
- PlacementTool получает `selectedFile`, вызывает `showFileGhost()`.
- Призрак (иконка + имя файла) следует за курсором до клика по холсту. Реализовано в `GhostController.showFileGhost()`.

### 3. Файл добавляется на доску

- Клик по холсту с активным `selectedFile` вызывает `placeSelectedFile()`.
- Файл загружается на сервер через `fileUploadService.uploadFile()` → `emitFileUploaded()` или при ошибке → `emitFileFallback()`.
- Создаётся объект `type: 'file'` (FileObject). Призрак скрывается, инструмент переключается на select.

### 4. Файл выделяется рамкой

- После размещения файл можно выделить кликом (SelectTool).
- При выделении `HtmlHandlesLayer` рисует рамку вокруг объекта по его bounds.
- Ручки ресайза для файла скрыты (`isFileTarget` в HandlesDomRenderer), рамка — строго по контуру объекта.

### 5. При выделении появляется кнопка «Скачать»

- `FilePropertiesPanel` показывается при одиночном выделении объекта с `type: 'file'`.
- Панель содержит кнопку `.moodboard-file-panel-download` («Скачать»).
- Панель создаётся в `MoodBoardUiFactory`, висит в `board.filePropertiesPanel`.

### 6. При клике на кнопку «Скачать» файл скачивается

- `FilePropertiesPanel._download()` вызывает `fileUploadService.downloadFile(fileId, fileName)`.
- Файл скачивается (через fetch + blob + a.download или аналогичный механизм).

### 7. Рамка и ручки отображаются корректно, строго по контуру файла

- Рамка совпадает с bounds объекта (worldBounds → cssRect в HandlesPositioningService).
- Для файла ручки ресайза не отображаются (файл не ресайзится), рамка — только контур.
- При zoom/pan рамка обновляется (`HtmlHandlesLayer.update`).

### 8. Файл перемещается по доске

- Выделенный файл перетаскивается (TransformFlow, MoveObjectCommand).
- Координаты объекта обновляются в exportBoard.

### 9. Файл удаляется

- Выделенный файл можно удалить (Delete, Backspace или контекстное меню).
- `DeleteObjectCommand` удаляет объект с холста; для файла с `fileId` вызывается `fileUploadService.deleteFile(fileId)`.
- Undo восстанавливает объект.

---

## Референс: что уже есть

### Существующие тесты и потоки

- **`tests/tools/ToolManager.image-drop.test.js`** — unit: drop файлов (non-image) → создание file-объекта, upload или fallback.
- **`tests/tools/PlacementTool.baseline.ghost.test.js`** — unit: ghost для note, shape, frame (не для file).
- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke по типам (в т.ч. может быть file).
- **`tests/image-object2/NoteTool.e2e.spec.js`** — образец E2E с `createObject`, `setSelection`, хелперами.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar attachments | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarDialogsController.js` | Кнопка attachments (custom-attachments), `openFileDialog()` |
| События | `Events.js` | `Place.FileSelected`, `Place.FileCanceled` |
| Ghost | `GhostController.js` | `showFileGhost()` — иконка, имя, размер 120×140 |
| Placement | `PlacementTool.js`, `PlacementEventsBridge.js`, `PlacementInputRouter.js` | `placeSelectedFile()`, `Place.FileSelected` → showFileGhost |
| Payload | `PlacementPayloadFactory.js` | `emitFileUploaded()`, `emitFileFallback()` |
| Объект | `FileObject.js`, `ObjectFactory.js` | type: 'file' |
| Панель свойств | `FilePropertiesPanel.js` | Кнопка «Скачать» `.moodboard-file-panel-download` |
| Рамка/ручки | `HtmlHandlesLayer.js`, `HandlesDomRenderer.js` | Рамка по bounds, ручки ресайза скрыты для file |
| Upload | `FileUploadService.js` | `uploadFile()`, `downloadFile()`, `deleteFile()` |
| Commands | `DeleteObjectCommand.js` | Удаление file, revoke fileId с сервера |

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/FileTool.e2e.spec.js` по аналогии с `NoteTool.e2e.spec.js`, `ImageTool.e2e.spec.js`:

1. **Диалог выбора файла** — клик по `.moodboard-toolbar__button--attachments` → проверка, что создаётся/открывается file input (или mock через `page.route` / `setInputFiles` для симуляции выбора файла).
2. **Призрак файла** — симулировать выбор файла (`Place.FileSelected` или `setInputFiles` + ожидание ghost), проверить наличие призрака на холсте (PIXI-контейнер в world или визуальный элемент).
3. **Файл добавляется на доску** — выбрать файл через панель, кликнуть на холст, проверить появление объекта type: 'file' в exportBoard.
4. **Файл выделяется рамкой** — создать file через API, выделить, проверить наличие `.mb-handles-box` или рамки вокруг объекта.
5. **Кнопка «Скачать» при выделении** — выделить file, проверить видимость `.moodboard-file-panel-download` или `.moodboard-file-properties-panel`.
6. **Скачивание по клику** — выделить file с fileId, клик по кнопке «Скачать»; mock `fileUploadService.downloadFile` или проверка вызова; при реальном сервере — проверка начала скачивания.
7. **Рамка по контуру** — выделить file, проверить, что bounds рамки совпадают с bounds объекта (или визуально корректно).
8. **Перемещение файла** — создать file, выделить, перетащить; проверить изменение position в exportBoard.
9. **Удаление файла** — создать file, выделить, Delete/Backspace; проверить отсутствие объекта в exportBoard. При наличии undo — проверить восстановление.

Использовать страницу `/test-moodboard.html`. Хелперы: `createObject('file', position, { fileName, fileSize, fileId, ... })`, `getObjectById`, `getObjectCanvasCenter`, `setSelection`, `triggerUndo`, `triggerRedo`.

### 2. Unit-тесты (по необходимости)

- **Ghost для file** — в `PlacementTool.baseline.ghost.test.js` или отдельном файле: `Place.FileSelected` → `showFileGhost` → ghost добавлен в world с корректными размерами (120×140).
- **FilePropertiesPanel** — при `SelectionAdd` с одним file показывается панель и кнопка «Скачать» (если ещё нет coverage).

### 3. Особенности E2E для файла

- **Фикстура файла** — использовать маленький тестовый файл (например, `tests/fixtures/test-document.pdf` или `test-file.txt`) для `setInputFiles`.
- **Upload mock** — в E2E без бэкенда можно mock `fileUploadService.uploadFile` на возврат `{ fileId: 'test-file-id', url: '...', name: 'test.txt', size: 0 }` или использовать fallback (emitFileFallback) при отключённом upload.
- **Download** — при mock fileUploadService проверять вызов `downloadFile`; при реальном сервере — проверять начало скачивания (например, по появлению blob URL или созданию anchor).

### 4. Документация

- Обновить `TESTS.md`: секция `FileTool.e2e.spec.js` (что покрыто).
- Краткие комментарии к describe/test.

---

## Селекторы для E2E

- Кнопка файлов: `.moodboard-toolbar__button--attachments`
- File input: создаётся динамически, для симуляции — `page.locator('input[type="file"]')` после клика.
- Панель свойств файла: `.moodboard-file-properties-panel`
- Кнопка «Скачать»: `.moodboard-file-panel-download`
- Рамка/ручки: `.mb-handles-box`, `.mb-handle`
- Canvas: `.moodboard-workspace__canvas canvas`

---

## Формат объекта file

```js
{
  type: 'file',
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fileId?: string,  // после upload
  properties: {
    fileName: string,
    fileSize: number,
    mimeType?: string
  }
}
```

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

1. Изучить потоки: кнопка attachments → openFileDialog → Place.FileSelected → showFileGhost → placeSelectedFile; FilePropertiesPanel, HtmlHandlesLayer для file.
2. Создать тестовую фикстуру файла (txt или pdf) в `tests/fixtures/`.
3. Создать `FileTool.e2e.spec.js` с тестами: диалог, призрак, добавление, выделение, кнопка «Скачать», скачивание, рамка, перемещение, удаление.
4. Добавить unit-тест для ghost file при необходимости.
5. Обновить `TESTS.md`.

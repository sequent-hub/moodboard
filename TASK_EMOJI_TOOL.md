# Задача: E2E-тесты инструмента «Эмоджи»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст», «Записка», «Добавить картинку», «Фигуры» и «Файлы». См. `tests/image-object2/ImageTool.e2e.spec.js`, `tests/image-object2/NoteTool.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для инструмента «Эмоджи»: меню, отображение, добавление на доску, призрак, перемещение, масштабирование, вращение и удаление.

---

## Действия (scope)

### 1. Меню с эмоджи появляется

- Кнопка «Эмоджи» (`.moodboard-toolbar__button--emoji`, `type: 'custom-emoji'`) при клике вызывает `toggleEmojiPopup()`.
- Popup (`.moodboard-toolbar__popup--emoji`) становится видимым (`display: block`).
- Popup содержит секции по категориям (Смайлики, Жесты, Котики и т.д.) и кнопки эмоджи.

### 2. Эмоджи отображаются

- В popup рендерятся эмоджи: `.moodboard-emoji__section`, `.moodboard-emoji__title`, `.moodboard-emoji__grid`, `.moodboard-emoji__btn`, `.moodboard-emoji__img`.
- Эмоджи загружаются из встроенных PNG (`getInlinePngEmojiUrl`) или fallback (`getFallbackEmojiGroups`) при отсутствии `import.meta.glob`.
- Каждая кнопка содержит `<img>` с `src` (data URL или URL файла).

### 3. Эмоджи добавляются на доску

- Клик по эмоджи в popup → `Place.Set` с `type: 'image'`, `properties: { src, width, height, isEmojiIcon: true, emojiCode }`.
- При `placeOnMouseUp: true` (drag из popup) или клике с последующим кликом по холсту → `emitGenericPlacement('image', position, props)`.
- Создаётся объект `type: 'image'` с `properties.isEmojiIcon: true` (ImageObject). Core устанавливает `lockedAspect: true`, `aspect: 1` для эмоджи.

### 4. Призрак отображается

- После выбора эмоджи (Place.Set с type: 'image') вызывается `showImageUrlGhost()` — призрак по `properties.src`.
- Призрак следует за курсором до клика по холсту. Размер 64×64 (targetW/targetH в popup).

### 5. Эмоджи можно перетаскивать по доске

- Выделенный эмоджи (image с isEmojiIcon) перетаскивается через TransformFlow, MoveObjectCommand.
- Координаты объекта обновляются в exportBoard.

### 6. Эмоджи можно масштабировать

- HtmlHandlesLayer показывает ручки ресайза для типа image (в отличие от file).
- Ресайз сохраняет квадратные пропорции (`lockedAspect`, `aspect: 1`).
- ResizeObjectCommand обновляет width/height.

### 7. Эмоджи можно вращать

- Ручка поворота отображается (HtmlHandlesLayer для image).
- RotateObjectCommand обновляет transform.rotation.

### 8. Эмоджи можно удалить

- Выделенный эмоджи удаляется (Delete, Backspace или контекстное меню).
- DeleteObjectCommand удаляет объект. Undo восстанавливает.

---

## Референс: что уже есть

### Существующие тесты

- **`tests/ui/Toolbar.baseline.popups.test.js`** — unit: emoji popup toggles on button click; click outside closes popup.
- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke: создание emoji через API (type: 'emoji' с content), выделение, удаление. Примечание: popup создаёт type: 'image' с isEmojiIcon, а smoke использует type: 'emoji' (EmojiObject).

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar emoji | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarPopupsController.js` | Кнопка emoji (custom-emoji), `toggleEmojiPopup()`, `createEmojiPopup()` |
| Popup | `ToolbarPopupsController.js` | `createEmojiPopup`, `getFallbackEmojiGroups`, клик по кнопке → Place.Set |
| Ghost | `GhostController.js` | `showImageUrlGhost()` для type: 'image' (эмоджи идут как image) |
| Placement | `PlacementTool.js`, `PlacementEventsBridge.js`, `PlacementInputRouter.js` | Place.Set → showImageUrlGhost, placeOnMouseUp или обычный placement |
| Payload | `PlacementPayloadFactory.js` | `emitGenericPlacement('image', ...)` |
| Объект | `ImageObject.js`, `ObjectFactory.js` | type: 'image', properties.isEmojiIcon |
| Core | `index.js` | При type === 'image' && isEmojiIcon: lockedAspect, aspect: 1 |
| Рамка/ручки | `HtmlHandlesLayer.js`, `HandlesDomRenderer.js` | Ручки для image (не file) |
| Inline emoji | `inlinePngEmojis.js` | `getInlinePngEmojiUrl(emojiCode)` — встроенные PNG |
| Fallback | `ToolbarPopupsController.getFallbackEmojiGroups` | Категории и коды эмоджи при отсутствии glob |

---

## Важное примечание: два типа эмоджи

В проекте существуют два типа эмоджи-объектов:

1. **Из popup (инструмент «Эмоджи»)** — `type: 'image'`, `properties.isEmojiIcon: true`, `properties.src` (URL PNG). Создаётся через Place.Set → emitGenericPlacement. **Это scope данной задачи.**
2. **EmojiObject (type: 'emoji')** — `type: 'emoji'`, `properties.content` (символ), `properties.fontSize`. Используется в SelectTool.types-smoke и через API. Не создаётся через popup.

E2E-тесты инструмента «Эмоджи» должны работать с объектами type: 'image' и isEmojiIcon.

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/EmojiTool.e2e.spec.js` по аналогии с `NoteTool.e2e.spec.js`, `ImageTool.e2e.spec.js`:

1. **Меню появляется** — клик по `.moodboard-toolbar__button--emoji` → popup `.moodboard-toolbar__popup--emoji` виден, содержит хотя бы одну секцию и кнопки эмоджи.
2. **Эмоджи отображаются** — в popup есть элементы `.moodboard-emoji__btn`, `.moodboard-emoji__img` с заполненным `src`.
3. **Эмоджи добавляются на доску** — клик по эмоджи в popup, клик по холсту; проверка появления объекта type: 'image' с `properties.isEmojiIcon: true` в exportBoard.
4. **Призрак отображается** — после клика по эмоджи в popup призрак виден на холсте (PIXI-контейнер в world или визуальный элемент) и следует за курсором.
5. **Перетаскивание** — создать emoji (image+isEmojiIcon) через API или popup, выделить, перетащить; проверить изменение position.
6. **Масштабирование** — выделить emoji, ресайз ручкой; проверить изменение width/height (с учётом lockedAspect).
7. **Вращение** — выделить emoji, поворот ручкой; проверить transform.rotation.
8. **Удаление** — выделить emoji, Delete; проверить отсутствие объекта. Undo — восстановление.

Использовать страницу `/test-moodboard.html`. Хелперы: `createObject('image', position, { src: dataUrl, width: 64, height: 64, isEmojiIcon: true })`, `getObjectById`, `getObjectCanvasCenter`, `setSelection`, `triggerUndo`, `triggerRedo`.

### 2. Drag из popup (опционально)

- При drag эмоджи из popup на холст (`placeOnMouseUp: true`) — проверить добавление объекта в месте отпускания кнопки мыши.
- Может потребовать эмуляции mousedown → mousemove → mouseup по canvas.

### 3. Unit-тесты (по необходимости)

- **Ghost для emoji** — Place.Set type: 'image' с isEmojiIcon, src → showImageUrlGhost вызывается; ghost добавлен в world.
- **Popup** — уже есть в Toolbar.baseline.popups.test.js.

### 4. Документация

- Обновить `TESTS.md`: секция `EmojiTool.e2e.spec.js`.
- Краткие комментарии к describe/test.

---

## Селекторы для E2E

- Кнопка эмоджи: `.moodboard-toolbar__button--emoji`
- Popup: `.moodboard-toolbar__popup--emoji`
- Секция: `.moodboard-emoji__section`
- Заголовок категории: `.moodboard-emoji__title`
- Сетка: `.moodboard-emoji__grid`
- Кнопка эмоджи: `.moodboard-emoji__btn`
- Изображение: `.moodboard-emoji__img`
- Рамка/ручки: `.mb-handles-box`, `.mb-handle`
- Canvas: `.moodboard-workspace__canvas canvas`

---

## Формат объекта emoji (из popup)

```js
{
  type: 'image',
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: {
    src: string,           // data URL или URL PNG
    isEmojiIcon: true,
    emojiCode?: string,    // например "1f600"
    lockedAspect: true,
    aspect: 1
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

1. Изучить потоки: кнопка emoji → toggleEmojiPopup → createEmojiPopup; клик по эмоджи → Place.Set (type: image, isEmojiIcon) → showImageUrlGhost; placement → emitGenericPlacement.
2. Создать `EmojiTool.e2e.spec.js` с тестами: меню, отображение, добавление, призрак, перемещение, масштабирование, вращение, удаление.
3. При необходимости добавить unit-тест для ghost emoji.
4. Обновить `TESTS.md`.

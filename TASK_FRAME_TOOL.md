# Задача: E2E-тесты инструмента «Фрейм»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст», «Записка», «Картинка», «Фигуры», «Файлы» и «Эмоджи». См. `tests/image-object2/ImageTool.e2e.spec.js`, `tests/image-object2/NoteTool.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для инструмента «Фрейм»: дополнительная панель, добавление всех типов фреймов, перемещение, масштабирование, добавление объектов на фрейм, перемещение объектов с фреймом, произвольный фрейм захватывает объекты, переименование, смена типа, смена фона, рамка и выделение.

---

## Действия (scope)

### 1. Дополнительная панель с фреймами появляется

- Кнопка «Добавить фрейм» (`.moodboard-toolbar__button--frame`, `type: 'frame'`) при клике вызывает `toggleFramePopup(button)`.
- Popup (`.frame-popup`, `moodboard-toolbar__popup`) становится видимым (`display: grid`).
- Popup содержит кнопки: «Произвольный» (`.frame-popup__btn--header`), A4, 1:1, 4:3, 16:9 (`.frame-popup__btn`, `frame-popup__holder`, `frame-popup__preview`, `frame-popup__caption`).

### 2. Все фреймы добавляются на доску

- **Произвольный** — клик по «Произвольный» → Place.Set type: 'frame-draw' → режим рисования прямоугольника на холсте; mousedown → mousemove → mouseup создаёт фрейм через `emitFrameDrawPlacement`.
- **A4, 1:1, 4:3, 16:9** — клик по пресету → Place.Set type: 'frame' с properties (width, height, title, lockedAspect, type); ghost появляется; клик по холсту → emitGenericPlacement или Place.Set с placeOnMouseUp отсутствует — для frame используется обычный flow: PlacementInputRouter onMouseDown размещает по клику.
- Проверить: каждый тип создаёт объект type: 'frame' в exportBoard.

### 3. Фрейм перемещается по доске

- Выделенный фрейм перетаскивается (TransformFlow, Events.Tool.DragUpdate).
- LayerAndViewportFlow.DragEnd для frame → GroupMoveCommand с фреймом и его детьми (attachments).
- Координаты обновляются в exportBoard.

### 4. Фрейм масштабируется

- HtmlHandlesLayer показывает ручки ресайза для frame (frame не как file).
- ResizeObjectCommand обновляет width/height. Для пресетов (не custom) — lockedAspect сохраняет пропорции.

### 5. На фрейм добавляются объекты

- При создании объекта (text, note, image и т.д.) core.createObject проверяет `findObjectByPosition(center, 'frame')`.
- Если центр нового объекта попадает внутрь фрейма → `properties.frameId = hostFrame.id`.
- E2E: создать фрейм, создать объект внутри (например, note) → в объекте есть properties.frameId.

### 6. Объекты перемещаются вместе с фреймом

- FrameService: при DragStart фрейма сохраняются позиции детей; при DragUpdate — дети смещаются на тот же delta; при DragEnd — GroupMoveCommand с фреймом и attachments.
- LayerAndViewportFlow.DragEnd для frame → GroupMoveCommand(moves, true) — coordinatesAreTopLeft.
- E2E: фрейм с объектом внутри → переместить фрейм → объект сдвинулся на ту же величину.

### 7. Произвольный фрейм захватывает объекты при создании

- FrameService слушает Events.Object.Created; для frame с isArbitrary (title === 'Произвольный' или lockedAspect === false или isArbitrary === true) вызывает `_attachIntersectingObjectsToFrame(frameId)`.
- Объекты, чьи bounds пересекаются с bounds нового фрейма, получают `properties.frameId = frameId`.
- E2E: создать note/эмоджи на доске → нарисовать произвольный фрейм так, чтобы он охватил объект → объект прикреплён к фрейму (frameId в properties).

### 8. Фрейм можно переименовать

- FramePropertiesPanel отображается при одиночном выделении фрейма.
- Поле «Название» (`.fpp-input`) — `titleInput`; при input эмитируется Events.Object.StateChanged с updates.properties.title.
- FrameObject.setTitle обновляет отображение.

### 9. У фрейма можно изменить тип

- Select в панели (`.fpp-select`) — значения: custom, a4, 1x1, 4x3, 16x9.
- При change вызывается `_applyFrameType(v)` — обновляет properties.type, для пресетов меняет размеры под аспект (ResizeUpdate, ResizeEnd), включая lockedAspect.

### 10. У фрейма можно изменить фон

- Кнопка цвета (`.fpp-color-button`) — при клике показывается палитра (`.color-palette`).
- Выбор цвета → Events.Object.StateChanged с updates.backgroundColor → FrameObject.setBackgroundColor / setFill.

### 11. Рамка вокруг фрейма отображается корректно, по границам фрейма

- HtmlHandlesLayer для frame: рамка по worldBounds, HandlesPositioningService.worldBoundsToCssRect.
- Ручка поворота скрыта для frame (`isFrameTarget` в HandlesDomRenderer, строка 167).
- Ручки ресайза отображаются (в отличие от file).

### 12. Выделение фрейма работает

- SelectTool: клик по фрейму выделяет его; HtmlHandlesLayer показывает рамку и ручки.
- При необходимости — двойной клик по объекту внутри фрейма или клик по краю фрейма; SelectInputRouter учитывает hasChildren (объекты с frameId).

---

## Референс: что уже есть

### Существующие тесты

- **`tests/ui/Toolbar.baseline.popups.test.js`** — возможно есть тест frame popup (аналогично emoji).
- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke по типам, в т.ч. frame.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar frame | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarPopupsController.js` | Кнопка frame (type: 'frame'), `toggleFramePopup()`, `createFramePopup()` |
| Popup | `ToolbarPopupsController.js` | createFramePopup: Произвольный, A4, 1:1, 4:3, 16:9; Place.Set для пресетов, frame-draw для произвольного |
| Ghost | `GhostController.js` | `showFrameGhost()` для type: 'frame' |
| Frame-draw | `PlacementInputRouter.js` | startFrameDrawMode, onFrameDrawMove, onFrameDrawUp; emitFrameDrawPlacement |
| Payload | `PlacementPayloadFactory.js` | `emitFramePlacement`, `emitFrameDrawPlacement` |
| Объект | `FrameObject.js`, `ObjectFactory.js` | type: 'frame' |
| Панель свойств | `FramePropertiesPanel.js` | Название, тип, фон (`.frame-properties-panel`, `.fpp-input`, `.fpp-select`, `.fpp-color-button`) |
| FrameService | `FrameService.js` | _attachIntersectingObjectsToFrame (захват при создании произвольного), перемещение детей с фреймом |
| Core | `index.js` | createObject: findObjectByPosition → frameId при размещении внутри фрейма |
| LayerAndViewportFlow | `LayerAndViewportFlow.js` | DragEnd frame → GroupMoveCommand с attachments |
| Рамка/ручки | `HtmlHandlesLayer.js`, `HandlesDomRenderer.js` | isFrameTarget — скрывает rotate, оставляет resize |
| Core | `index.js` | `_getFrameChildren(frameId)` |

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/FrameTool.e2e.spec.js`:

1. **Панель появляется** — клик по `.moodboard-toolbar__button--frame` → popup `.frame-popup` виден, содержит кнопки Произвольный, A4, 1:1, 4:3, 16:9.
2. **Все фреймы добавляются** — для каждого пресета (A4, 1:1, 4:3, 16:9): клик по кнопке, клик по холсту; для произвольного: mousedown → mousemove → mouseup. Проверить появление type: 'frame' с ожидаемыми размерами/типом.
3. **Перемещение** — создать frame, выделить, перетащить; проверить изменение position.
4. **Масштабирование** — выделить frame, ресайз ручкой; проверить width/height.
5. **Объекты на фрейм** — создать frame, создать note/text внутри (центр попадает в фрейм); проверить properties.frameId у объекта.
6. **Объекты перемещаются с фреймом** — frame с note внутри; переместить frame; проверить, что note сдвинулся на ту же величину.
7. **Произвольный фрейм захватывает объекты** — создать note на доске; нарисовать произвольный фрейм поверх; проверить frameId у note.
8. **Переименование** — выделить frame, ввести текст в `.fpp-input`; проверить properties.title в exportBoard.
9. **Изменение типа** — выделить frame, выбрать другой тип в `.fpp-select`; проверить properties.type и размеры (для пресетов).
10. **Изменение фона** — выделить frame, клик по `.fpp-color-button`, выбор цвета в палитре; проверить backgroundColor.
11. **Рамка по границам** — выделить frame; проверить, что `.mb-handles-box` bounds корректны (или визуально); rotate скрыт.
12. **Выделение** — клик по фрейму → selectedObjects содержит id фрейма; рамка видна.

Хелперы: `createObject('frame', position, { width, height, title, type, ... })`, `getObjectById`, `getObjectCanvasCenter`, `setSelection`, эмуляция frame-draw (mousedown → mousemove → mouseup).

### 2. Unit-тесты (по необходимости)

- **Ghost для frame** — Place.Set type: 'frame' → showFrameGhost.
- **FrameService._attachIntersectingObjectsToFrame** — при создании произвольного фрейма объекты внутри получают frameId.
- **Frame-draw** — onFrameDrawUp создаёт фрейм с корректными x, y, w, h.

### 3. Документация

- Обновить `TESTS.md`: секция `FrameTool.e2e.spec.js`.
- Краткие комментарии к describe/test.

---

## Селекторы для E2E

- Кнопка фрейма: `.moodboard-toolbar__button--frame`
- Popup: `.frame-popup`, `.moodboard-toolbar__popup`
- Кнопки: `.frame-popup__btn`, `.frame-popup__btn--header` (Произвольный), `.frame-popup__btn[data-id="a4"]` и т.д.
- Панель свойств: `.frame-properties-panel`
- Название: `.fpp-input`
- Тип: `.fpp-select`
- Фон: `.fpp-color-button`
- Палитра: `.color-palette`
- Рамка: `.mb-handles-box`
- Canvas: `.moodboard-workspace__canvas canvas`

---

## Формат объекта frame

```js
{
  type: 'frame',
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  backgroundColor?: number,
  properties: {
    title: string,
    type: 'custom' | 'a4' | '1x1' | '4x3' | '16x9',
    lockedAspect?: boolean,
    isArbitrary?: boolean,
    borderColor?: number,
    ...
  }
}
```

Объекты внутри фрейма: `properties.frameId = frame.id`.

---

## Примечание: произвольный vs пресеты

- **Пресеты (A4, 1:1, 4:3, 16:9)** — Place.Set с type: 'frame', фиксированные размеры; ghost; клик по холсту размещает.
- **Произвольный** — Place.Set type: 'frame-draw'; режим рисования; mousedown задаёт угол, mousemove рисует прямоугольник, mouseup создаёт фрейм через emitFrameDrawPlacement. После создания FrameService._attachIntersectingObjectsToFrame захватывает пересекающиеся объекты.

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

1. Изучить потоки: frame popup, frame-draw, emitFrameDrawPlacement, FrameService._attachIntersectingObjectsToFrame, createObject + findObjectByPosition, GroupMoveCommand при drag frame.
2. Создать `FrameTool.e2e.spec.js` с тестами по списку действий.
3. При необходимости добавить unit-тесты.
4. Обновить `TESTS.md`.

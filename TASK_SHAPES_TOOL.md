# Задача: E2E-тесты и проверка инструмента «Фигуры»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст», «Записка» и «Добавить картинку». См. `tests/image-object2/TextTool.e2e.spec.js`, `NoteTool.e2e.spec.js`, `ImageTool.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для инструмента «Фигуры»: меню, добавление каждой фигуры, трансформации (move, resize, rotate), рамки и ручки при выделении; проверить, что рамка строго по контуру, без пересечений и наложений.

---

## Действия (scope)

### 1. Дополнительное меню с фигурами

- Кнопка «Фигуры» (`.moodboard-toolbar__button--shapes`, `type: 'custom-shapes'`) при клике открывает всплывающее меню (`.moodboard-toolbar__popup--shapes`).
- Меню содержит фигуры: квадрат, скругленный квадрат, круг, треугольник, ромб, параллелограмм, стрелка.
- Кнопки фигур: `.moodboard-shapes__btn--shape`, `.moodboard-shapes__btn--circle`, `.moodboard-shapes__btn--triangle` и т.д.

### 2. Добавление фигур на доску

- После выбора фигуры в меню эмитируется `Place.Set` с `type: 'shape'`, `properties: { kind: '...' }`.
- PlacementTool активируется, показывается призрак (`showShapeGhost`), клик на холст размещает фигуру.
- Каждый вид фигуры (square, circle, rounded, triangle, diamond, parallelogram, arrow) должен успешно добавляться.

### 3. Трансформации

- **Перемещение** — drag объектом по холсту → изменение `position`.
- **Вращение** — ручка поворота `.mb-rotate-handle` → изменение `transform.rotation`.
- **Масштабирование** — ручки ресайза `.mb-handle[data-dir="se"]` и др. → изменение `width`, `height`.

### 4. Рамки и ручки при выделении

- При выделении фигуры появляются рамка и ручки (HtmlHandlesLayer).
- Рамка должна строго соответствовать контуру объекта, не пересекаться с ним и не накладываться на него.

---

## Референс: что уже есть

### Существующие тесты

- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke по типам объектов, в т.ч. `type: 'shape'` с `kind: 'circle'`: создание через API, выделение, move, resize, rotate.
- **`tests/tools/PlacementTool.baseline.ghost.test.js`** — unit: ghost для shape (Place.Set type: shape).
- **`tests/ui/HtmlHandlesLayer.*.test.js`** — baseline трансформаций, групповой resize/rotate.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar shapes | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarPopupsController.js` | Кнопка shapes, popup меню, `Place.Set` для shape |
| Ghost | `GhostController.js` | `showShapeGhost` (Place.Set type: shape) |
| Placement | `PlacementTool.js`, `PlacementEventsBridge.js`, `PlacementInputRouter.js` | Размещение фигуры по клику |
| Transform | `TransformFlow.js`, `HtmlHandlesLayer.js`, `HandlesDomRenderer.js` | Move, Resize, Rotate, рамка выделения |
| Объект | `ShapeObject.js`, `ObjectFactory.js` | type: 'shape', properties.kind |

### Виды фигур (properties.kind)

- `square`, `rounded` (cornerRadius), `circle`, `triangle`, `diamond`, `parallelogram`, `arrow`

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/ShapesTool.e2e.spec.js`:

1. **Меню появляется** — клик по `.moodboard-toolbar__button--shapes` → popup `.moodboard-toolbar__popup--shapes` виден, содержит кнопки фигур.
2. **Добавление каждой фигуры** — для каждого kind (square, circle, rounded, triangle, diamond, parallelogram, arrow): выбор в меню → клик на холст → объект shape появился с корректным kind.
3. **Перемещение** — createObject(type: 'shape') → выделение → drag → проверка изменения position.
4. **Вращение** — createObject → выделение → drag rotate handle → проверка transform.rotation.
5. **Увеличение/уменьшение** — createObject → выделение → drag resize handle (SE) → проверка width/height.
6. **Рамки и ручки при выделении** — после выделения фигуры: `.mb-handle`, `.mb-rotate-handle` видимы; рамка `.mb-selection-frame` или аналог присутствует.
7. **Рамка по контуру** — визуальная проверка: рамка не пересекается с объектом, не накладывается поверх, строго по границам. (E2E через bounds или скриншот; при невозможности — unit/визуальный чек-лист в документации.)

Использовать страницу `/test-moodboard.html` и хелперы по образцу ImageTool/NoteTool: `createObject`, `getObjectById`, `getObjectCanvasCenter`, `setSelection`, `triggerUndo`, `triggerRedo`.

### 2. Undo/Redo (если ещё не покрыто)

- Добавление фигуры — undo удаляет, redo восстанавливает.
- Перемещение, ресайз, поворот — undo/redo для каждой команды.
- Smoke по shape уже в SelectTool.types-smoke; при необходимости добавить отдельные тесты.

### 3. Документация

- Обновить `TESTS.md`: секция `ShapesTool.e2e.spec.js` (что покрыто).
- Краткие комментарии к describe/test в E2E-файле.

---

## Особенности фигур

| Аспект | Значение |
|--------|----------|
| Тип объекта | `type: 'shape'` |
| Вид | `properties.kind`: square, rounded, circle, triangle, diamond, parallelogram, arrow |
| Размеры | width, height (по умолчанию 100×100) |
| Цвет | `color` (number, по умолчанию 0x3b82f6) |
| Кнопка тулбара | `.moodboard-toolbar__button--shapes` |
| Popup | `.moodboard-toolbar__popup--shapes`, `.moodboard-shapes__grid` |
| Добавление | PlacementTool + Place.Set (type: shape, properties: { kind }) |

---

## Селекторы для E2E

- Кнопка фигур: `.moodboard-toolbar__button--shapes`
- Popup: `.moodboard-toolbar__popup--shapes`
- Кнопки фигур в grid: `.moodboard-shapes__btn--circle`, `.moodboard-shapes__btn--triangle` и т.д.
- Ручки ресайза: `.mb-handle[data-id="${id}"][data-dir="se"]`
- Ручка поворота: `.mb-rotate-handle[data-id="${id}"]`

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

1. Изучить текущие потоки: кнопка shapes, `toggleShapesPopup`, `Place.Set`, `showShapeGhost`, размещение.
2. Создать `ShapesTool.e2e.spec.js` с тестами: меню, добавление каждой фигуры, move, resize, rotate.
3. Добавить тест рамок и ручек при выделении; при возможности — проверку «рамка по контуру».
4. Добавить undo/redo при необходимости.
5. Обновить `TESTS.md`.

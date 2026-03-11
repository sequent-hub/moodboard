# Задача: E2E-тесты и команды для групповых действий и выделения

**Контекст:** Инструменты (текст, записка, картинка, фигуры, файлы, эмоджи, фрейм, рисование) уже покрыты задачами TASK_*. Теперь нужно проверить и покрыть тестами **групповое выделение**, **групповые команды** и **историю** для групповых операций.

**Цель:** Добавить E2E-тесты для группового выделения (рамка, Shift/Ctrl+клик), выделения всех типов объектов, группового перемещения/вращения/масштабирования/удаления; при необходимости — доработать команды истории и поддержку Shift для multi-select.

---

## Действия (scope)

### 1. Групповое выделение работает

- **Рамка-область выделения (box select)** — клик по пустому месту с зажатой кнопкой мыши и перетаскивание рисует прямоугольник; объекты, пересекающие область, выделяются. Реализовано в `BoxSelectController`.
- **Модификатор при клике** — клик по объекту с зажатым модификатором добавляет/убирает объект из выделения без сброса остальных. Сейчас: `Ctrl` или `Cmd` (metaKey). Пользователь ожидает также **Shift** — при необходимости добавить `event.shiftKey` в `isMultiSelect`.
- **Box select с модификатором** — при зажатом Ctrl/Cmd (и возможно Shift) box select добавляет к текущему выделению вместо замены. `BoxSelectController.start(mouse, isMultiSelect)`.

### 2. Выделение работает для всех типов объектов

Проверить одиночное и групповое выделение для:

- text, note, image, shape, drawing, file, emoji (image+isEmojiIcon), frame
- Фреймы **исключены** из box select (`BoxSelectController`: `if (meta.type === 'frame') continue`) — их выделяют только кликом по рамке.
- Объекты внутри фрейма (frameId) — проверка hitTest и выделения.

### 3. Групповое перемещение

- Выделить несколько объектов → перетащить группу → все сдвигаются на один вектор.
- `GroupDragController`, `LayerAndViewportFlow` → `GroupMoveCommand`.
- Undo/Redo группового перемещения — одна команда `GroupMoveCommand` откатывает/повторяет всё.

### 4. Групповое вращение

- Выделить несколько объектов → ручка поворота группы → поворот вокруг общего центра.
- `GroupRotateController`, `GroupRotateCommand`.
- Shift при повороте — шаг 15° (если реализовано в `GroupRotateController`).
- Undo/Redo — `GroupRotateCommand`.

### 5. Групповое масштабирование

- Выделить несколько объектов → ресайз за угловую/боковую ручку группы → масштабирование относительно противоположной точки.
- `GroupResizeController`, `GroupResizeCommand`.
- Shift при ресайзе — фиксация пропорций (`maintainAspectRatio`).
- Undo/Redo — `GroupResizeCommand`.

### 6. Групповое удаление

- Выделить несколько объектов → Delete/Backspace → все удаляются.
- `deleteSelectedObjects()` → `Events.Tool.ObjectsDelete` с массивом ids → `core.deleteObject(id)` для каждого.
- **Текущая реализация:** каждый `deleteObject` создаёт отдельную `DeleteObjectCommand` — N команд для N объектов. Undo восстанавливает по одному объекту за раз.
- **Опционально:** ввести `GroupDeleteCommand` — одна команда удаляет/восстанавливает всю группу одним undo.

### 7. Выделение через рамку (box select)

- mousedown на пустом месте → mousemove (рисуется прямоугольник) → mouseup → объекты в области выделены.
- Визуал: `PIXI.Graphics` с именем `selection-box`, синяя обводка и полупрозрачная заливка.
- Фреймы не включаются в box select.
- С модификатором (Ctrl/Cmd) — добавление к выделению.

### 8. Выделение через Shift (или Ctrl/Cmd)

- Клик по объекту с зажатым **Ctrl** или **Cmd** (metaKey) — добавление в выделение или снятие, если уже выделен. Текущая логика: `isMultiSelect = event.originalEvent.ctrlKey || event.originalEvent.metaKey` в `SelectInputRouter`.
- Если требуется **Shift** — добавить `event.originalEvent.shiftKey` в условие.
- Двойной клик по объекту в группе — редактирование (text/note/file), не смена выделения.

### 9. Select All (Ctrl+A)

- `selectAll()` эмитирует `Tool.SelectionAll`; реализация «выделить все объекты» имеет TODO в `SelectionStateController`. Проверить, обрабатывается ли `Tool.SelectionAll` где-либо для фактического выделения всех объектов.
- При необходимости доработать: слушатель `Tool.SelectionAll` → getAllObjects → setSelection(ids).

---

## Референс: что уже есть

### Существующие тесты и потоки

- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke: одиночное выделение, удаление, copy/paste, layer ops для каждого типа объекта.
- **`tests/ui/HtmlHandlesLayer.baseline.transforms.test.js`** — групповые трансформации, rotate/resize, рамка.
- **`tests/ui/HtmlHandlesLayer.group-rotate-geometry.test.js`** — геометрия повёрнутой рамки группы.
- **`tests/ui/HtmlHandlesLayer.group-resize-repeat.test.js`** — повторный group resize, Shift.
- **`tests/core/CoreIndex.baseline.transforms.test.js`** — GroupResizeUpdate.
- **`tests/tools/SelectTool.baseline.selection.test.js`** — selectAll, clearSelection, events.
- **`tests/tools/SelectTool.note.test.js`** — double-click note.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Box select | `BoxSelectController.js` | start/update/end, rectIntersectsRect, исключение frame |
| Select input | `SelectInputRouter.js` | isMultiSelect = ctrlKey \|\| metaKey, handleObjectSelect, startBoxSelect |
| Transform | `TransformInteractionController.js` | handleObjectSelect, startGroupDrag, startBoxSelect |
| Команды | `GroupMoveCommand.js`, `GroupRotateCommand.js`, `GroupResizeCommand.js` | Групповые операции |
| Layer flow | `LayerAndViewportFlow.js` | GroupDragUpdate/End, GroupMoveCommand |
| Delete | `ObjectLifecycleFlow.js` | ObjectsDelete → core.deleteObject(id) для каждого |
| Delete cmd | `DeleteObjectCommand.js` | Удаление одного объекта |
| Selection | `SelectionStateController.js` | deleteSelectedObjects, selectAll (TODO) |
| Handles | `HtmlHandlesLayer.js`, `GroupSelectionHandlesController.js` | Рамка и ручки группы |
| HitTest | `HitTestService.js` | Определение объекта под курсором |

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/GroupSelection.e2e.spec.js`:

1. **Box select** — mousedown на пустом месте → mousemove (область охватывает 2+ объектов) → mouseup → selection содержит все попавшие в область (кроме frame).
2. **Box select + Ctrl** — уже есть выделение → box select с Ctrl → старые + новые в selection.
3. **Multi-select кликом (Ctrl)** — выделить объект A, Ctrl+клик по B → оба выделены; Ctrl+клик по A → A снимается.
4. **Выделение всех типов** — создать по одному объекту каждого типа (text, note, image, shape, drawing, file, emoji, frame); проверить одиночное выделение кликом для каждого.
5. **Group move** — создать 2–3 объекта, выделить группу (box или Ctrl+клик), перетащить; проверить изменение position у всех.
6. **Group rotate** — выделить группу, повернуть за ручку; проверить rotation у всех.
7. **Group resize** — выделить группу, ресайз за ручку; проверить width/height.
8. **Group delete** — выделить группу, Delete; проверить отсутствие объектов. Undo — восстановление (текущее поведение: N undo для N объектов, или один при GroupDeleteCommand).
9. **Shift для multi-select** — если добавлена поддержка Shift: Shift+клик добавляет в выделение.
10. **Select All (Ctrl+A)** — если реализовано: Ctrl+A выделяет все объекты на доске.

### 2. Unit-тесты (по необходимости)

- **BoxSelectController** — start с isMultiSelect, update сопоставляет объекты, end обновляет selection; frame исключён.
- **GroupMoveCommand** — execute/undo для нескольких объектов.
- **GroupDeleteCommand** — если вводится: execute удаляет все, undo восстанавливает все.

### 3. Доработки кода (после диагностики)

- **Shift для multi-select** — в `SelectInputRouter.onMouseDown` добавить `event.originalEvent.shiftKey` в `isMultiSelect` при явном запросе.
- **Select All** — если не реализовано: слушатель `Tool.SelectionAll` → GetAllObjects → setSelection(ids).
- **GroupDeleteCommand** — опционально: одна команда для группового удаления с одним undo.

### 4. Документация

- Обновить `TESTS.md`: секция `GroupSelection.e2e.spec.js`.
- Зафиксировать: Ctrl/Cmd для multi-select, (опционально) Shift; frame исключён из box select.

---

## Селекторы и хелперы для E2E

- Canvas: `.moodboard-workspace__canvas canvas`
- Рамка группы: `.mb-handles-box` (после выделения нескольких объектов)
- Box select визуал: PIXI Graphics `name: 'selection-box'` — проверить через `page.evaluate` или наличие дочернего элемента.
- Хелперы: `createObject`, `getObjectById`, `setSelection`, `getSelection`, `dragBy` (mousedown → mousemove → mouseup с delta), `triggerUndo`, `triggerRedo`.
- Эмуляция модификаторов: `page.mouse.click(x, y, { modifiers: ['Control'] })` или `page.keyboard.down('Control'); ... click ... ; page.keyboard.up('Control')`.

---

## События и команды

| Действие | События | Команда |
|----------|---------|---------|
| Group move | DragStart, GroupDragUpdate, DragEnd | GroupMoveCommand |
| Group rotate | RotateStart, GroupRotateUpdate, GroupRotateEnd | GroupRotateCommand |
| Group resize | ResizeStart, GroupResizeUpdate, GroupResizeEnd | GroupResizeCommand |
| Group delete | ObjectsDelete | DeleteObjectCommand × N (или GroupDeleteCommand) |

---

## Примечание: Frame и box select

Фреймы специально исключены из box select (`BoxSelectController`): их выделяют только кликом по захватной области. Это учтено в scope — E2E должен проверять, что frame не попадает в selection при box select.

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования.
- Не выдвигать гипотез — сначала сбор информации, логирование, диагностика.
- Изменять код только после явного разрешения («можно»).
- Перед рефактором — baseline-тесты.

---

## Порядок выполнения

1. Изучить потоки: BoxSelectController, SelectInputRouter (isMultiSelect), handleObjectSelect, GroupMove/Rotate/ResizeCommand, ObjectsDelete.
2. Проверить Select All — кто обрабатывает Tool.SelectionAll, реализовано ли выделение всех объектов.
3. Создать `GroupSelection.e2e.spec.js` с тестами: box select, multi-select, типы, group move/rotate/resize/delete.
4. При необходимости: добавить Shift в isMultiSelect, доработать Select All, ввести GroupDeleteCommand.
5. Обновить `TESTS.md`.

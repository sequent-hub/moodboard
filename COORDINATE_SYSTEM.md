# Система координат MoodBoard (техническая карта)

Документ фиксирует фактическую реализацию вычисления и передачи координат в проекте.
Цель: диагностика проблем точности и подготовка тестов.

## 1. Системы координат в проекте

В коде одновременно используются несколько пространств:

- **DOM/CSS**: `clientX/clientY`, CSS `left/top/width/height` для HTML-слоев (`HtmlHandlesLayer`, `HtmlTextLayer`).
- **World (`worldLayer`)**: рабочие координаты инструментов и логики преобразований.
- **PIXI display**: координаты `pixiObject.x/y` в сцене.
- **State**: `state.objects[].position` хранится как **левый верх** (`top-left`).
- **Bounds (`getBounds`)**: глобальные экранные границы PIXI, часто переводятся обратно в world.

Ключевой инвариант:

- `state(top-left) -> pixi(center)`: `x = left + width / 2`, `y = top + height / 2`
- `pixi(center) -> state(top-left)`: `left = x - width / 2`, `top = y - height / 2`

## 2. Основные узлы, где считаются координаты

- `src/tools/ToolManager.js` — вход мыши/клавиатуры, базовые `event.x/y`.
- `src/tools/object-tools/SelectTool.js` — select/drag/resize/rotate/group-потоки, `_toWorld`.
- `src/ui/HtmlHandlesLayer.js` — активная система ручек, CSS<->world преобразования, resize/rotate events.
- `src/core/index.js` — применение трансформаций к PIXI/state, `GetObject*` API, команды истории.
- `src/core/PixiEngine.js` — pivot/anchor и компенсации при создании/обновлениях.
- `src/services/ZoomPanController.js` — zoom вокруг точки курсора.
- `src/tools/board-tools/PanTool.js` — pan (`delta` в экранных пикселях).
- `src/ui/MapPanel.js` — mini-map и пересчет `mini <-> world`.
- `src/ui/HtmlTextLayer.js` — синхронизация HTML-текста с world и углом объекта.
- `src/tools/object-tools/selection/*` — альтернативные контроллеры resize/rotate/group.

## 3. Потоки передачи координат

### 3.1 Выделение и отрисовка ручек

1. `ToolManager` передает `event.x/y` в инструмент.
2. `SelectTool` делает hit-test через `Events.Tool.HitTest`.
3. `CoreMoodBoard` вызывает `pixi.hitTest`.
4. `HtmlHandlesLayer.update()` строит bounds:
   - одиночный объект: `GetObjectPosition + GetObjectSize`;
   - группа: `getBounds()` каждого + `world.toLocal(...)`.
5. Для HTML-рамки: world -> screen через `world.toGlobal(...)`.

### 3.2 Drag одиночного объекта

1. `SelectTool._toWorld()` переводит курсор в world.
2. `SimpleDragController` считает offset захвата и эмитит `tool:drag:update`.
3. `CoreMoodBoard.updateObjectPositionDirect`:
   - пересчитывает в центр PIXI (`+halfW/+halfH`);
   - пишет top-left в `state.position`.
4. На `DragEnd` создается `MoveObjectCommand`, если координаты изменились.

### 3.3 Drag группы

1. На `GroupDragStart` в core сохраняется snapshot позиций объектов.
2. На `GroupDragUpdate` применяется delta к позициям.
3. State обновляется как left-top, визуал — через PIXI.
4. На `GroupDragEnd` фиксируется `GroupMoveCommand`.

### 3.4 Resize одиночного объекта (активный путь)

Основной путь проходит через `HtmlHandlesLayer`:

1. На `mousedown` ручки фиксируются `startCSS`.
2. CSS -> world по формуле с учетом `renderer.resolution`, `world.scale`, `world.x/y`.
3. На `mousemove` пересчитывается `newLeft/newTop/newW/newH` в CSS.
4. Затем отправляется `Events.Tool.ResizeUpdate` в world-координатах.
5. `CoreMoodBoard` применяет ограничения (аспект/минимумы/позиция) и вызывает `updateObjectSizeAndPositionDirect`.
6. На `ResizeEnd` создается `ResizeObjectCommand`.

### 3.5 Resize группы

1. `GroupResizeStart` с `startBounds` (world).
2. `GroupResizeUpdate` в core:
   - вычисление `sx/sy`,
   - пересчет центра каждого объекта относительно центра стартовой группы,
   - перевод центра в top-left.
3. Применение через `updateObjectSizeAndPositionDirect`.
4. `GroupResizeEnd` -> `GroupResizeCommand`.

### 3.6 Rotate одиночного объекта

1. `HtmlHandlesLayer._onRotateHandleDown` берет центр из CSS-box.
2. `atan2` от курсора до центра -> `deltaAngle`.
3. `RotateUpdate` (градусы) -> core обновляет PIXI/state.
4. `RotateEnd` -> `RotateObjectCommand`.

### 3.7 Rotate группы

1. `GroupRotateStart` -> snapshot стартовых углов/позиций.
2. `GroupRotateUpdate`:
   - поворот центра объекта вокруг общего центра группы,
   - перевод в top-left с учетом `halfW/halfH`,
   - запись угла.
3. `GroupRotateEnd` -> `GroupRotateCommand`.

### 3.8 Pan / Zoom

- `PanTool` эмитит `tool:pan:update` с экранным `delta`.
- Core сдвигает `worldLayer.x/y`.
- `ZoomPanController` сохраняет world-точку под курсором, меняет scale и корректирует `world.x/y`, чтобы точка оставалась под курсором.
- `HtmlHandlesLayer` и `HtmlTextLayer` подписаны на pan/zoom и делают пересчет позиции.

## 4. События EventBus, по которым передаются координаты

Основные координатные события:

- `tool:drag:start|update|end`
- `tool:group:drag:start|update|end`
- `tool:resize:start|update|end`
- `tool:group:resize:start|update|end`
- `tool:rotate:update|end`
- `tool:group:rotate:start|update|end`
- `tool:pan:update`
- `tool:wheel:zoom`
- `tool:get:*` (`position`, `size`, `rotation`, `pixi`, `all-objects`, `selection`, `hit-test`)
- `ui:zoom:percent`

Ключевой обработчик координатных событий: `src/core/index.js`.

## 5. Зафиксированные точки риска точности (по текущему коду)

Ниже перечень мест, которые важно покрывать диагностикой и тестами:

- Параллельное использование left-top (state) и center (PIXI/snapshots групп).
- Частое округление (`Math.round`) в HTML-слое во время transform.
- Комбинация разных путей преобразований:
  - формула CSS<->world;
  - `toGlobal`/`toLocal`;
  - fallback через `getBounds`.
- Наличие альтернативных контроллерных путей (`selection/*Controller`) и HTML-пути.
- Константные пороги и отступы (`20`, `38`, `10`, `1800`, `cornerGap`, `edgeSize`, `padding`).
- Командные payload для групповых операций требуют проверки контракта координат (center vs top-left).

## 6. Логирование для диагностики перед исправлениями

Рекомендуемый минимальный пакет логирования:

- На входе операции:
  - `clientX/clientY`, `event.x/y`, тип ручки/инструмента, id объекта(ов).
- Контекст сцены:
  - `world.scale`, `world.x/y`, `renderer.resolution`.
- До/после применения:
  - `state.position/size/rotation`,
  - `pixi.x/y/width/height/rotation`.
- Для групп:
  - snapshot start,
  - `sx/sy`,
  - центр группы,
  - итоговый payload в команду (`GroupMove/GroupResize/GroupRotate`).

## 7. Базовый план тестирования координат

Стартовый набор тестов:

- `single_drag_topLeft_center_roundtrip`
- `single_resize_each_handle_contract`
- `single_rotate_center_consistency`
- `group_drag_coordinate_contract`
- `group_resize_scale_about_center`
- `group_rotate_center_contract`
- `html_handles_alignment_under_zoom_pan`
- `css_world_conversion_non_1_resolution`
- `command_payload_coordinate_contracts`
- `minimap_zoom_world_point_invariant`

## 8. Связанные файлы

- `ARCHITECTURE.md` — общая архитектура проекта.
- `src/core/index.js` — центральная логика применения координат.
- `src/ui/HtmlHandlesLayer.js` — основная активная система ручек.
- `src/tools/object-tools/SelectTool.js` — маршрутизация пользовательских transform-действий.


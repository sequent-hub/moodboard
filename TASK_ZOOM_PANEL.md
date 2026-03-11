# Задача: E2E-тесты панели зума

**Контекст:** Панель зума (ZoomPanel) и карта доски (MapPanel) — часть workspace. См. `src/ui/ZoomPanel.js`, `src/ui/MapPanel.js`, `src/services/ZoomPanController.js`, `src/core/flows/LayerAndViewportFlow.js`.

**Цель:** Добавить E2E-тесты для панели зума: кнопки +/-, зум колесом, пункты меню «По размеру экрана», «К выделению», «100%», панель с картой доски.

---

## Действия (scope)

### 1. Кнопки + и − работают

- **Кнопка +** (zoom-in) — `.moodboard-zoombar__button[data-action="zoom-in"]` при клике эмитирует `Events.UI.ZoomIn`.
- **Кнопка −** (zoom-out) — `.moodboard-zoombar__button[data-action="zoom-out"]` эмитирует `Events.UI.ZoomOut`.
- ZoomPanController обрабатывает ZoomIn/ZoomOut → эмитирует `Tool.WheelZoom` с delta ±120 → масштаб worldLayer меняется (шаг 10%).
- Проверка: клик + → `world.scale.x` увеличивается; клик − → уменьшается; `Events.UI.ZoomPercent` обновляет label.

### 2. Зум колесом мыши работает

- Событие `wheel` на `manager.container` → `ToolEventRouter.handleMouseWheel` → `Events.Tool.WheelZoom` с `{ x, y, delta: event.deltaY }`.
- ZoomPanController слушает WheelZoom → меняет scale worldLayer, пересчитывает world.x/y чтобы точка под курсором оставалась на месте.
- Шаг: 10% (кратные 10: 10, 20, …, 500).
- Проверка: колесо вверх (deltaY < 0) → zoom in; колесо вниз → zoom out. Либо через `page.mouse.wheel(deltaX, deltaY)` в Playwright.

### 3. Пункт меню «По размеру экрана» работает

- Клик по `.moodboard-zoombar__label` открывает меню `.moodboard-zoombar__menu`.
- Пункт «По размеру экрана» — первый `.moodboard-zoombar__menu-item` → `Events.UI.ZoomFit`.
- ZoomPanController (ZoomFit): вычисляет bbox всех объектов, подбирает scale чтобы все поместились (padding 40px), центрирует.
- Если объектов нет — выходит без изменений.
- Проверка: несколько объектов на доске → ZoomFit → scale соответствует bbox; label обновляется.

### 4. Пункт меню «К выделению» работает

- Пункт «К выделение» — второй пункт меню → `Events.UI.ZoomSelection`.
- LayerAndViewportFlow: получает selectedObjects из selectTool; если пусто — выходит; вычисляет bbox выделенных, подбирает scale, центрирует.
- Проверка: создать объект, выделить, открыть меню, «К выделению» → масштаб подстроен под выделение.

### 5. Пункт меню «100%» работает

- Пункт «100%» — третий пункт меню → `Events.UI.ZoomReset`.
- ZoomPanController: scale = 1, пересчитывает world.x/y чтобы центр экрана оставался на той же мировой точке.
- Проверка: после зума вызвать «100%» → `world.scale.x === 1`, label «100%».

### 6. Панель с картой доски работает

- Кнопка «Карта» — `.moodboard-mapbar__button` при клике открывает/закрывает popup `.moodboard-mapbar__popup`.
- Popup содержит canvas `.moodboard-minimap-canvas` — рисует миникарту: объекты (прямоугольники), выделенные подсвечены синим, рамка видимой области (world/view).
- События: `MinimapGetData` (world, view, objects), `MinimapCenterOn` (клик/драг по миникарте центрирует основной вид).
- Колесо мыши над popup — зум в точке под курсором (minimap → world → WheelZoom).
- Проверка: клик по кнопке → popup виден, canvas отображается; при наличии объектов — они на миникарте; клик по миникарте — панорама смещается.

---

## Референс: что уже есть

### Существующие тесты

- **`test-zoom-panel.html`** — ручной тест zoom/map panel.
- Unit-иллюстративные тесты для zoom могут быть в других файлах.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| ZoomPanel | `ZoomPanel.js` | Кнопки +/-, label с %, меню (По размеру экрана, К выделению, 100%) |
| MapPanel | `MapPanel.js` | Кнопка «Карта», popup с canvas, renderMinimap, MinimapGetData, MinimapCenterOn, WheelZoom в popup |
| ZoomPanController | `ZoomPanController.js` | ZoomIn, ZoomOut, ZoomReset, ZoomFit, WheelZoom |
| LayerAndViewportFlow | `LayerAndViewportFlow.js` | ZoomSelection, MinimapGetData, MinimapCenterOn |
| ToolEventRouter | `ToolEventRouter.js` | handleMouseWheel → WheelZoom |
| ToolManagerLifecycle | `ToolManagerLifecycle.js` | container.addEventListener('wheel', …) |

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/ZoomPanel.e2e.spec.js` (или `tests/ui/ZoomPanel.e2e.spec.js`):

1. **Кнопки + и −** — клик по `[data-action="zoom-in"]` → scale увеличился; клик по `[data-action="zoom-out"]` → уменьшился; `.moodboard-zoombar__label-value` обновляется.
2. **Зум колесом** — эмуляция `page.mouse.wheel(0, -100)` над canvas → zoom in; `(0, 100)` → zoom out. Проверка scale через `page.evaluate` (world.scale.x).
3. **По размеру экрана** — создать 2–3 объекта, открыть меню (клик по label), клик по «По размеру экрана» → scale подставлен под bbox; при пустой доске — без падений.
4. **К выделению** — создать объект, выделить, меню → «К выделению» → scale под выделение.
5. **100%** — произвести zoom (кнопка или колесо), меню → «100%» → scale === 1, label «100%».
6. **Панель карты** — клик по `.moodboard-mapbar__button` → `.moodboard-mapbar__popup` виден, `.moodboard-minimap-canvas` присутствует; при объектах — canvas не пустой (опционально snapshot); клик по canvas → world.x/y изменились (MinimapCenterOn).

### 2. Хелперы

- `getWorldScale(page)` — `world.scale.x` через core.
- `getZoomPercentLabel(page)` — текст `.moodboard-zoombar__label-value`.
- `openZoomMenu(page)` — клик по `.moodboard-zoombar__label`, ожидание `.moodboard-zoombar__menu`.
- `clickZoomMenuItem(page, index)` — клик по n-му `.moodboard-zoombar__menu-item` (0: По размеру экрана, 1: К выделению, 2: 100%).

### 3. Селекторы

- Zoombar: `.moodboard-zoombar`
- Кнопки: `.moodboard-zoombar__button[data-action="zoom-in"]`, `[data-action="zoom-out"]`
- Label/меню: `.moodboard-zoombar__label`, `.moodboard-zoombar__label-value`, `.moodboard-zoombar__menu`, `.moodboard-zoombar__menu-item`
- Mapbar: `.moodboard-mapbar`, `.moodboard-mapbar__button`, `.moodboard-mapbar__popup`, `.moodboard-minimap-canvas`
- Canvas для wheel: `.moodboard-workspace__canvas` или внутренний canvas

### 4. События

- `Events.UI.ZoomIn`, `Events.UI.ZoomOut`, `Events.UI.ZoomReset`, `Events.UI.ZoomFit`, `Events.UI.ZoomSelection`
- `Events.UI.ZoomPercent` — { percentage }
- `Events.Tool.WheelZoom` — { x, y, delta }
- `Events.UI.MinimapGetData`, `Events.UI.MinimapCenterOn`
- `Events.UI.MapToggle`

### 5. Документация

- Обновить `TESTS.md`: секция `ZoomPanel.e2e.spec.js`.

---

## Особенности

- **Колесо** — Playwright `page.mouse.wheel(deltaX, deltaY)`; deltaY < 0 = zoom in, > 0 = zoom out. Координаты — относительно viewport или элемента.
- **ZoomFit при пустой доске** — ZoomPanController выходит сразу (return), scale не меняется.
- **ZoomSelection без выделения** — LayerAndViewportFlow выходит, scale не меняется.
- **Миникарта** — Canvas 2D, requestAnimationFrame для renderMinimap; данные через MinimapGetData (core заполняет world, view, objects). BoardService тоже слушает MinimapGetData, но core (LayerAndViewportFlow) задаёт objects.

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования.
- Не выдвигать гипотез — сначала сбор информации.
- Изменять код только после явного разрешения («можно»).

---

## Порядок выполнения

1. Изучить: ZoomPanel attach, ZoomPanController, LayerAndViewportFlow ZoomSelection, ToolEventRouter handleMouseWheel, MapPanel showPopup/renderMinimap.
2. Создать `ZoomPanel.e2e.spec.js` с тестами по списку действий.
3. Обновить `TESTS.md`.

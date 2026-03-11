# Задача: E2E-тесты верхней панели (Top Panel)

**Контекст:** Верхняя панель (Topbar) содержит кнопки выбора вида сетки (линии, точки, крестики, выкл) и палитру фона доски. См. `src/ui/Topbar.js`, `src/services/BoardService.js`, `src/moodboard/integration/MoodBoardEventBindings.js`.

**Цель:** Добавить E2E-тесты для верхней панели: все сетки работают, отключение сетки работает, фон доски меняется.

---

## Действия (scope)

### 1. Все сетки работают

- **Линии (line)** — кнопка `[data-grid="line"]` при клике переключает сетку на линейную. BoardService создаёт `LineGrid`, добавляет в `gridLayer`. Сетка отображается на холсте.
- **Точки (dot)** — кнопка `[data-grid="dot"]` переключает на точечную сетку (`DotGrid`).
- **Крестики (cross)** — кнопка `[data-grid="cross"]` переключает на сетку с крестиками (`CrossGrid`).
- Проверка: клик по кнопке → активный класс на кнопке (`.moodboard-topbar__button--active`), сетка видна на canvas (PIXI `gridLayer` содержит дочерний элемент с графикой).
- Альтернатива: эмитируется `Events.UI.GridChange` с type; BoardService применяет; `Events.UI.GridCurrent` возвращает type.

### 2. Отключение сетки работает

- **Выкл (off)** — кнопка `[data-grid="off"]` при клике отключает сетку.
- BoardService: `type === 'off'` → `grid.setEnabled(false)`, `grid.updateVisual()`, `pixi.setGrid(grid)` — сетка остаётся в слое, но визуально скрыта (enabled: false).
- Проверка: клик по «Сетка: выкл» → сетка не отображается; `Events.Grid.BoardDataChanged` с `grid: { type: 'off' }`.

### 3. Фон доски меняется

- Кнопка «краска» (`.moodboard-topbar__button--paint`) при клике открывает popover с палитрой цветов.
- Popover: `.moodboard-topbar__paint-popover`, `.moodboard-topbar__paint-grid`, кнопки `.moodboard-topbar__paint-btn` с `data-board` (hex фона) и `data-hex` (цвет кнопки).
- Клик по цвету в палитре → `Events.UI.PaintPick` с `{ color, btnHex }` → `MoodBoardEventBindings` → `settingsApplier.set({ backgroundColor })` или прямая установка `renderer.backgroundColor`.
- Проверка: выбрать другой цвет → `app.renderer.backgroundColor` или `app.renderer.background.color` меняется; визуально фон canvas обновляется.
- Палитра: 5 цветов (default-light #f7fbff, mint-light #f8fff7, peach-light #fffcf7, gray-light #f5f5f5, white #ffffff).

---

## Референс: что уже есть

### Существующие тесты

- **`test-topbar-simple.html`**, **`test-topbar-new.html`** — ручные тесты topbar, загрузка иконок, базовое отображение.
- **`tests/moodboard/MoodBoard.baseline.init.test.js`** — mock Topbar, topbarContainer.
- **`tests/moodboard/MoodBoard.baseline.ui-wiring.test.js`** — settingsApplier, mapBoardToBtnHex.
- Unit-тестов E2E для topbar нет.

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Topbar | `Topbar.js` | createTopbar, кнопки `[data-grid]`, paint popover, Events.UI.GridChange, PaintPick |
| BoardService | `BoardService.js` | Events.UI.GridChange → GridFactory.createGrid, setGrid, Grid.BoardDataChanged |
| GridFactory | `GridFactory.js` | createGrid(type), line/dot/cross |
| LineGrid | `LineGrid.js` | линейная сетка |
| DotGrid | `DotGrid.js` | точечная сетка |
| CrossGrid | `CrossGrid.js` | сетка крестиков |
| MoodBoardEventBindings | `MoodBoardEventBindings.js` | PaintPick → settingsApplier.set / renderer.backgroundColor |
| SettingsApplier | `SettingsApplier.js` | set({ backgroundColor }) → renderer.backgroundColor |
| PixiEngine | `PixiEngine.js` | gridLayer, setGrid() |
| LayerManager | `LayerManager.js` | gridLayer |

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/TopPanel.e2e.spec.js` (или `tests/ui/TopPanel.e2e.spec.js`):

1. **Сетка line** — клик по `.moodboard-topbar__button[data-grid="line"]` → кнопка активна; gridLayer содержит графику; или проверка через `page.evaluate` — `window.moodboard.coreMoodboard.pixi.gridLayer.children.length > 0`, type line.
2. **Сетка dot** — клик по `[data-grid="dot"]` → переключение, визуально точки.
3. **Сетка cross** — клик по `[data-grid="cross"]` → переключение, крестики.
4. **Отключение сетки** — клик по `[data-grid="off"]` → сетка скрыта (grid.setEnabled(false) или gridLayer пуст/не виден). Проверка: `boardService.grid?.enabled === false` или аналог.
5. **Фон доски** — клик по `.moodboard-topbar__button--paint` → popover `.moodboard-topbar__paint-popover` виден; клик по `.moodboard-topbar__paint-btn[data-board="#ffffff"]` (или другому) → `renderer.backgroundColor` соответствует выбранному цвету.

Страница: `/test-moodboard.html` (MoodBoard с topbar в workspace).

### 2. Хелперы для E2E

- `getGridLayerChildren(page)` — `page.evaluate` возвращает количество детей gridLayer или структуру.
- `getRendererBackgroundColor(page)` — `app.renderer.backgroundColor` в hex.
- `getActiveGridButton(page)` — селектор активной кнопки сетки.
- Проверка видимости сетки: gridLayer children или canvas snapshot (опционально, если нужно визуально).

### 3. Селекторы

- Topbar: `.moodboard-topbar`, `.moodboard-workspace__topbar`
- Кнопки сетки: `.moodboard-topbar__button[data-grid="line"]`, `[data-grid="dot"]`, `[data-grid="cross"]`, `[data-grid="off"]`
- Активная кнопка: `.moodboard-topbar__button--active`
- Кнопка краски: `.moodboard-topbar__button--paint`
- Popover: `.moodboard-topbar__paint-popover`
- Палитра: `.moodboard-topbar__paint-grid`, `.moodboard-topbar__paint-btn`
- Canvas: `.moodboard-workspace__canvas canvas`

### 4. События

- `Events.UI.GridChange` — { type: 'line' | 'dot' | 'cross' | 'off' }
- `Events.UI.GridCurrent` — { type } — подтверждение текущего типа
- `Events.Grid.BoardDataChanged` — { grid: { type, options } }
- `Events.UI.PaintPick` — { color, btnHex, id, name }

### 5. Документация

- Обновить `TESTS.md`: секция `TopPanel.e2e.spec.js`.

---

## Особенности

- **Иконки** — TopbarIconLoader загружает SVG асинхронно; при E2E дождаться отрисовки кнопок (например, `expect(page.locator('.moodboard-topbar__button')).toHaveCount(5)` — 4 сетки + paint).
- **Сетка off** — при type 'off' grid не пересоздаётся, вызывается `setEnabled(false)`. Визуально слой gridLayer может содержать контейнер, но графика не рисуется или alpha = 0.
- **Фон** — PIXI v8 может использовать `renderer.background.color`, старые версии — `renderer.backgroundColor`. Проверять оба или через `background?.color ?? backgroundColor`.

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования.
- Не выдвигать гипотез — сначала сбор информации.
- Изменять код только после явного разрешения («можно»).

---

## Порядок выполнения

1. Изучить: Topbar createTopbar/attachEvents, BoardService GridChange, MoodBoardEventBindings PaintPick.
2. Проверить наличие topbar на странице test-moodboard.html (MoodBoard создаёт workspace с topbar).
3. Создать `TopPanel.e2e.spec.js` с тестами: line, dot, cross, off, фон.
4. Обновить `TESTS.md`.

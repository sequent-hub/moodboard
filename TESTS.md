# Тесты moodboard

## Инфраструктура

- **Фреймворк:** Vitest 3.2.4
- **Окружение:** jsdom
- **Конфигурация:** `vite.config.js` → секция `test`
- **Запуск:** `npm test` / `npx vitest run`

## Покрытие тестами

### `tests/objects/NoteObject.test.js` — 63 теста

Модель записки (`src/objects/NoteObject.js`).

- **Конструктор** — дефолтные и кастомные параметры, размеры, создание PIXI-объектов, метаданные `_mb`, граничные значения цветов (0x000000)
- **getPixi()** — возврат контейнера
- **setContent() / setText()** — обновление текста, `_mb.properties`, пустая строка, null/undefined
- **hideText() / showText()** — видимость textField, повторные вызовы
- **setStyle()** — fontSize, backgroundColor, borderColor, textColor, fontFamily, частичное обновление, lineHeight, пустые аргументы
- **updateSize()** — обновление размеров, квадратная форма, минимальные размеры, hitArea, null/undefined
- **updateCrispnessForZoom()** — resolution, devicePixelRatio, комбинации, отсутствие textField, граничные значения, roundPixels
- **Внутренние методы** — `_getVisibleTextWidth`, `_computeLineHeightPx` (все диапазоны), `_fitTextToBounds` (минимальный шрифт 8px)
- **Граничные случаи** — полный жизненный цикл, Unicode, многострочный текст, длинный текст (10000 символов)

### `tests/objects/ObjectFactory.test.js` — 40 тестов

Фабрика объектов (`src/objects/ObjectFactory.js`).

- **Реестр типов** — все 10 типов зарегистрированы (frame, shape, drawing, text, simple-text, emoji, image, comment, note, file)
- **has()** — незарегистрированный тип, пустая строка, null, undefined
- **create()** — создание note, text, simple-text (алиас), frame, shape; передача objectData; передача eventBus для frame; неизвестный тип → null
- **Обработка ошибок** — ошибка в конструкторе → null + console.error с указанием типа
- **register()** — новый тип, создание объектов, защита от пустых аргументов, перезапись типа
- **Интеграция** — цикл создания записки, eventBus не передаётся для note

### `tests/ui/NotePropertiesPanel.test.js` — 70 тестов

Панель свойств записки (`src/ui/NotePropertiesPanel.js`).

- **Конструктор** — сохранение зависимостей, инициализация, подписка на EventBus, core = null
- **DOM-структура** — класс/id панели, селектор шрифтов (12 шрифтов, Caveat первый), кнопки цветов фона/текста, палитры (по 6 цветов), поле размера шрифта (min=8, max=32)
- **show/hide** — showFor() показывает, hide() скрывает, скрытие палитр, вызов _updateControlsFromObject
- **updateFromSelection()** — пустая выборка, множественная выборка, одиночная записка, не-записка, несуществующий объект, дублирование
- **Реакция на события** — SelectionClear, Object.Deleted (свой/чужой), DragStart, GroupDragStart, Tool.Activated (select / другой)
- **Изменение свойств** — _changeFontSize → StateChanged, _changeFontFamily → StateChanged, _selectColor → StateChanged (backgroundColor, textColor), обновление кнопок цвета, защита при currentId === null
- **_updateControlsFromObject()** — синхронизация fontSize, fontFamily, защита от null
- **_updateColorButton()** — установка цвета, null-кнопка
- **_darkenHex()** — затемнение, amount=0/1, невалидный hex → fallback, без #
- **Палитры** — toggle (открытие), hideAll
- **reposition()** — скрытая панель, null currentId, объект не выделен, позиционирование через GetObjectPosition/GetObjectSize
- **destroy()** — удаление из DOM, обнуление, повторные вызовы
- **Граничные случаи** — отсутствие selectTool, отсутствие pixi, полный цикл

### `tests/tools/PlacementTool.test.js` — 51 тест

Инструмент размещения записки на холсте (`src/tools/object-tools/PlacementTool.js`).

- **Конструктор** — имя "place", инициализация pending/ghostContainer, подписки на Place.Set / Tool.Activated / Place.FileSelected, eventBus = null
- **Place.Set для записки** — установка pending, сброс при null, вызов showNoteGhost при наличии world, без world не вызывается
- **Tool.Activated → сброс** — сброс pending при select, hideGhost, не сбрасывает при других инструментах
- **showNoteGhost()** — создание ghostContainer, alpha=0.6, добавление в world, размеры 250x250 по умолчанию, кастомные размеры, удаление предыдущего ghost, защита от type !== note / null pending / null world
- **hideGhost()** — удаление из world, destroy, обнуление, защита от null ghostContainer / null world
- **updateGhostPosition()** — обновление координат, защита от null ghostContainer
- **activate()** — showNoteGhost при pending.type = note, установка app и world, курсор
- **onMouseDown** — ToolbarAction с type=note, центрирование 250x250, передача свойств, квадратная форма, сброс pending, hideGhost, переключение на select, защита при pending = null
- **deactivate()** — hideGhost, обнуление app/world, сброс курсора
- **_toWorld()** — преобразование координат, fallback без world
- **_getPendingCursor()** — crosshair для записки, text для текста, crosshair по умолчанию
- **Полный цикл** — Place.Set → activate → showGhost → mouseDown → place → select

### `tests/tools/SelectTool.note.test.js` — 13 тестов

Инструмент выделения — обработка записки (`src/tools/object-tools/SelectTool.js`).

- **textEditor** — неактивен по умолчанию, objectType = "text", objectId = null, textarea = null
- **onDoubleClick** — ObjectEdit с type=note для записки, получение позиции, пустой content, не-объект не вызывает ObjectEdit, text получает свой ObjectEdit
- **selectedObjects** — доступен через getter
- **Граничные случаи** — pixiObject = null, отсутствие _mb, _mb без type

### `tests/integration/NoteContentSave.test.js` — 7 тестов

Диагностический тест: цепочка сохранения текста записки.

- **SelectTool.finalize отправляет `{ content: value }` на верхнем уровне** — content попадает в `object.content`, а не в `object.properties.content`. Текст визуально обновляется (через UpdateObjectContent → setContent), но **не сохраняется в state** → при перезагрузке теряется.
- **NotePropertiesPanel отправляет `{ properties: { ... } }`** — корректно мержится в properties, не теряет остальные поля.
- **Корректный формат `{ properties: { content: value } }`** — content попадает в properties.content, остальные свойства сохраняются.
- **Полный цикл** — после finalize с текущим форматом, serialize возвращает старый content.

### `tests/EventBus.test.js` — 38 тестов (ранее)

### `tests/core/rendering/GeometryUtils.test.js` — 113 тестов (ранее)

### `tests/core/rendering/PixiRenderer.test.js` — 41 тестов (ранее)

### `tests/core/rendering/LayerManager.test.js` — 32/40 тестов (8 падают — ранее)

---

## TODO

### Обнаруженные проблемы

- [ ] **Текст записки не сохраняется** — `SelectTool.finalize` отправляет `StateChanged` с `updates: { content: value }` (верхний уровень), а обработчик в `core/index.js` кладёт это в `object.content` вместо `object.properties.content`. PIXI-отображение обновляется корректно (через `UpdateObjectContent`), но state для сохранения содержит старый текст. **Подтверждено тестом** `tests/integration/NoteContentSave.test.js`. Исправление: в `SelectTool` строки 2422–2427 и 2774–2779 отправлять `updates: { properties: { content: value } }`.
- [ ] **`_toggleColorPalette` не работает как toggle** — `NotePropertiesPanel._toggleColorPalette()` вызывает `_hideAllColorPalettes()` ДО проверки `isVisible`, из-за чего палитра всегда считается скрытой и открывается заново. Реального закрытия по повторному клику на кнопку не происходит.
- [ ] **`LayerManager.test.js` — 8 падающих тестов** — существующие тесты LayerManager не соответствуют текущему коду: addChild/removeChild вызываются не так как ожидают тесты, null/undefined аргументы не валидируются, конструктор не защищён от null app.

### Следующие тесты

- [x] ~~Тесты взаимодействия записки через `PlacementTool`~~ — 51 тест
- [x] ~~Тесты редактирования записки через `SelectTool`~~ — 13 тестов (onDoubleClick)
- [ ] Тесты обработки событий записки в `CoreMoodBoard` (UpdateObjectContent, StateChanged)
- [ ] Тесты `HtmlTextLayer` — отображение текста записки в HTML-слое
- [ ] Тесты `SelectTool._openTextEditor` для записки (NoteEditStart, textarea позиционирование, autoSize)
- [ ] Тесты `SelectTool._closeTextEditor` для записки (NoteEditEnd, UpdateObjectContent, showText)

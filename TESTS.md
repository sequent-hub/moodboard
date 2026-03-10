# Тесты moodboard

## Инфраструктура

- **Фреймворк:** Vitest 3.2.4
- **Окружение:** jsdom
- **Конфигурация:** `vite.config.js` → секция `test`
- **Запуск:** `npm test` / `npx vitest run`

## Покрытие тестами

**Обновление:** добавлены `24` теста для `HistoryManager` (`tests/core/HistoryManager.baseline.test.js`) — добавление команд в историю, undo/redo, merge, maxHistorySize, служебные методы.

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

### `tests/ui/NotePropertiesPanel.test.js` — 73 теста

Панель свойств записки (`src/ui/NotePropertiesPanel.js`).

- **Конструктор** — сохранение зависимостей, инициализация, подписка на EventBus, core = null
- **DOM-структура** — класс/id панели, селектор шрифтов (12 шрифтов, Caveat первый), кнопки цветов фона/текста, палитры (по 6 цветов), поле размера шрифта (min=8, max=32); font-select, font-size-input, data-color-value на swatch для E2E
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

### `tests/ui/ContextMenu.test.js` — 1 тест

Диагностический тест для контекстного меню (`src/ui/ContextMenu.js`).

- **hide() при `element = null`** — проверяет, что скрытие не падает с `Cannot read properties of null (reading 'style')` и корректно сбрасывает `isVisible`.

### `tests/ui/HtmlHandlesLayer.rotation.test.js` — 1 тест

Диагностический тест завершения поворота (`src/ui/HtmlHandlesLayer.js`).

- **mouseup после rotate-start** — проверяет, что `RotateEnd` эмитится даже если `currentTarget` исходного события больше недоступен; страхует от падения в конце rotate-flow.

### `tests/ui/HtmlHandlesLayer.baseline.transforms.test.js` — baseline-regressions групповых трансформаций

Базовые контракты синхронизации HTML-рамки и выделения (`src/ui/HtmlHandlesLayer.js`).

- **GroupRotateEnd сохраняет угол рамки** — рамка не должна самопроизвольно выпрямляться после завершения группового поворота.
- **GroupDragUpdate после поворота** — повернутая рамка должна продолжать ехать вместе с группой, не теряя угол.
- **Повторный group rotate** — новый жест поворота должен продолжаться от уже накопленного угла, без скачка назад к `0deg`.

### `tests/ui/HtmlHandlesLayer.group-rotate-geometry.test.js` — геометрия повернутой рамки группы

Геометрические регрессии для `rotate -> resize` у группы (`src/ui/HtmlHandlesLayer.js`, `src/ui/handles/HandlesInteractionController.js`, `src/core/flows/TransformFlow.js`).

- **Поворот группы из нескольких квадратов** — все углы выбранных объектов должны оставаться внутри повернутой рамки во время поворота и после `GroupRotateEnd`.
- **Resize уже повернутой группы** — после перехода `rotate -> resize` рамка должна оставаться по контурам объектов, а не пропускать углы наружу.

### `tests/ui/HtmlHandlesLayer.group-resize-repeat.test.js` — regressions повторного group resize

UI-level regressions для `group resize` и `Shift`-режима (`src/ui/handles/HandlesInteractionController.js`, `src/core/flows/TransformFlow.js`).

- **Повторный захват ручки** — второй `group resize` должен стартовать от текущей рамки, без скачка к старой геометрии.
- **`rotate -> resize`** — повернутая рамка не должна выпрямляться в момент входа в resize.
- **`Shift` после поворота** — пропорции рамки должны фиксироваться и оставаться стабильными.
- **Повторный пропорциональный resize** — второй жест с `Shift` должен продолжаться плавно от текущего размера.
- **Нажатие `Shift` во время активного жеста** — включение фиксации пропорций не должно вызывать скачок базы.
- **Все четыре угловые ручки** — маленькое движение курсора с `Shift` не должно давать крупный скачок рамки или объектов.
- **Крутой угол поворота** — на последовательности соседних `mousemove` пропорциональный resize не должен менять доминирующую ось скачкообразно.

### `tests/core/CoreIndex.baseline.transforms.test.js` — core-regressions группового resize

Базовые контракты ядра для `TransformFlow` (`src/core/flows/TransformFlow.js`).

- **GroupResizeUpdate использует центры объектов** — групповое масштабирование должно считаться от центров, а не от `top-left`.
- **Повторный GroupResizeStart** — новый resize-жест должен продолжаться от текущей геометрии группы, без скачка.

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

### `tests/integration/NoteContentSave.test.js` — 8 тестов

Диагностический тест: цепочка сохранения текста записки.

- **SelectTool.finalize отправляет `{ content: value }` на верхнем уровне** — content попадает в `object.content`, а не в `object.properties.content`. Текст визуально обновляется (через UpdateObjectContent → setContent), но **не сохраняется в state** → при перезагрузке теряется.
- **NotePropertiesPanel отправляет `{ properties: { ... } }`** — корректно мержится в properties, не теряет остальные поля.
- **Корректный формат `{ properties: { content: value } }`** — content попадает в properties.content, остальные свойства сохраняются.
- **Полный цикл** — после finalize с текущим форматом, serialize возвращает старый content.

### `tests/integration/NoteRotationSave.test.js` — 16 тестов

Диагностический тест: цепочка сохранения поворота записки.

- **updateObjectRotationDirect** — записывает в `transform.rotation`, создаёт объект `transform` при отсутствии, не перезатирает другие поля transform
- **_setupObjectTransform** — читает из `transform.rotation`, возвращает 0 при отсутствии
- **Полный цикл** — запись → чтение, несколько поворотов подряд

### Новый блок: сеть / загрузка изображений / сохранение

- `tests/services/ImageUploadService.timeout.test.js` — 4 теста: timeout `uploadImage`, серверная ошибка, CSRF-check, success с `imageId`.
- `tests/core/SaveManager.timeout.test.js` — 4 теста: поведение при timeout save, success-путь, отсутствие лишнего save при неизменных данных, `pending`-статус.
- `tests/integration/ImagePersistence.network-fail.test.js` — 2 теста: «локально видно, после reopen пропало» при timeout и контрольный success-кейс.
- `tests/core/SaveManager.retry.test.js` — 2 теста: retry/backoff и остановка после `maxRetries`.
- `tests/core/KeyboardManager.image-upload.test.js` — 2 теста: вставка изображения через клавиатурный канал (success + fallback `data:`).
- `tests/tools/ToolManager.image-drop.test.js` — 2 теста: drag-and-drop канал (success + fallback `data:`).
- `tests/ui/SaveStatus.test.js` — 5 тестов: `pending/saving/saved/error`, auto-hide, обработка `save:error`.
- `tests/integration/SaveStatus.network-state.test.js` — 2 теста: связка `SaveManager + SaveStatus` при success/timeout.
- `tests/core/SaveManager.unload-flush.test.js` — 4 теста: `beforeunload/pagehide/visibilitychange`, `sendBeacon`, sync XHR fallback.
- `tests/core/ApiClient.image-persistence.test.js` — 5 тестов: очистка image-данных при save, сохранение `imageId`, восстановление `src` при load, защита от перезаписи существующего `src`.

### `tests/image-object2/TextTool.e2e.spec.js` — 18 E2E-тестов

Инструмент «Текст» (text-add). Playwright E2E.

**История изменений (контекст для последующих агентов):**

- **Было:** Тестов не было. Изменения свойств текста (шрифт, размер, цвет, фон) через панель свойств шли через `Object.StateChanged` без команд — undo/redo не работали.
- **Сделано:**
  - Добавлены E2E-тесты: добавление текста, редактирование, ресайз ручками, панель свойств (шрифт, размер, цвет, фон), поворот.
  - Введена команда `UpdateContentCommand` — undo/redo для редактирования текста. Событие `Object.ContentChange` вместо `UpdateObjectContent` + `StateChanged`.
  - Введена команда `UpdateTextStyleCommand` — undo/redo для fontFamily, fontSize, color, backgroundColor. Перехват `StateChanged` в `ObjectLifecycleFlow` для типа `text` с одним из этих свойств.
  - В `HistoryManager` при merge вызывается `_executeCommandSafely(lastCommand)`, чтобы слитая команда применяла актуальное значение (fix для тестов «all fonts» / «all font sizes»).
- **Результат:** 18 тестов, включая undo/redo для добавления, редактирования, ресайза, шрифта, размера шрифта, цвета, фона, поворота.
- **Референс для Записки:** `TextTool.e2e.spec.js` — шаблон структуры, хелперы (`createObject`, `getObjectById`, `triggerUndo`, `triggerRedo`), тесты панели свойств и undo/redo.

**Покрытие:**

- Добавление текста, редактирование (двойной клик), ресайз, панель свойств (все шрифты, все размеры, цвет, фон), поворот.
- Undo/redo: добавление, редактирование, ресайз, шрифт, размер шрифта, цвет, фон, поворот.

### `tests/image-object2/NoteTool.e2e.spec.js` — 19 E2E-тестов

Инструмент «Записка» (note-add). Playwright E2E.

**История изменений:**

- **Было:** E2E-тестов для записки не было. Изменения свойств (шрифт, размер, цвет, фон) через `NotePropertiesPanel` шли через `Object.StateChanged` без команд — undo/redo не работали.
- **Сделано:**
  - Добавлены E2E-тесты: добавление записки через note-add, редактирование (двойной клик), ресайз ручками, панель свойств (.note-properties-panel: шрифт, размер, цвет текста, фон), поворот.
  - Введена команда `UpdateNoteStyleCommand` — undo/redo для fontFamily, fontSize, textColor, backgroundColor. Перехват `StateChanged` в `ObjectLifecycleFlow` для `object.type === 'note'`.
  - `Object.ContentChange` при закрытии редактора записки уже эмитился (проверено unit-тестом в TextInlineEditorController.baseline.commit-cancel).
  - В `NotePropertiesPanel` добавлены классы `.font-select`, `.font-size-input` и `data-color-value` на swatch-элементах для надёжных E2E-селекторов.
- **Результат:** 19 тестов (18 passed, 1 skipped). Skipped: «note edit cancel (Escape)» — возможная гонка blur/Escape, требуется диагностика.
- **Особенности:** Записка создаётся сразу с дефолтным текстом «Новая записка» (без editOnCreate в отличие от текста).

**Покрытие:**

- Добавление записки, редактирование (двойной клик), ресайз, панель свойств (шрифты, размер, цвет текста, фон), поворот.
- Undo/redo: добавление, редактирование, ресайз, поворот, шрифт, размер шрифта, цвет текста, фон.

### `tests/image-object2/ImageTool.e2e.spec.js` — 10 E2E-тестов

Инструмент «Добавить картинку» (основная кнопка image-add, `.moodboard-toolbar__button--image`). Кнопка image2 вне scope — см. TASK_IMAGE_TOOL.md.

**Покрытие:**

- Добавление через панель — file chooser → призрак → клик на холст. Тестовый файл: `tests/fixtures/test-image.png`.
- Добавление через paste — `Events.UI.PasteImage` с data URL (без реального clipboard).
- Перемещение, масштабирование, вращение — createObject(type: 'image') + ручки ресайза/поворота.
- Undo/redo: добавление, перемещение, ресайз, поворот.

**Скип:** Drop с устройства — ограничения Playwright (dataTransfer.files защищён).

### `tests/tools/PlacementTool.baseline.ghost.test.js` — 4 теста (было 3)

Добавлен тест для image: `Place.ImageSelected` → `showImageGhost` → ghost в world, `updateGhostPosition` обновляет координаты. Учтена асинхронность `showImageGhost` (PIXI.Texture.fromURL).

### `tests/core/UpdateNoteStyleCommand.test.js` — 15 unit-тестов

Команда `UpdateNoteStyleCommand` (`src/core/commands/UpdateNoteStyleCommand.js`).

- **execute** — применение fontFamily, fontSize, textColor, backgroundColor в object.properties и вызов instance.setStyle; создание properties при отсутствии.
- **undo** — восстановление каждого свойства.
- **canMergeWith** — true для той же objectId+property; false для другого objectId/property/типа команды.
- **mergeWith** — обновление newValue и timestamp; выброс при несовместимой команде.

### `tests/core/ObjectLifecycleFlow.note-style.test.js` — 5 тестов

Перехват `StateChanged` для записки в `ObjectLifecycleFlow`.

- StateChanged с properties.fontFamily/fontSize/textColor/backgroundColor для note → history.executeCommand(UpdateNoteStyleCommand).
- StateChanged для text по-прежнему создаёт UpdateTextStyleCommand (не перехватывается note).

### `tests/core/HistoryManager.baseline.test.js` — 24 теста

Механизм истории команд Undo/Redo (`src/core/HistoryManager.js`).

- **Добавление команд** — executeCommand добавляет команду, увеличивает currentIndex, вызывает command.execute(), эмитит Events.History.Changed; при пустой истории canUndo/canRedo; накопление нескольких команд; новая команда после undo отсекает redo-ветку; ограничение maxHistorySize; merge при canMergeWith и в mergeTimeout (объединение без execute входящей команды; после merge выполняется lastCommand для применения слитого значения); merge за пределами mergeTimeout; команда при isExecutingCommand выполняется, но не добавляется в историю.
- **Перемещение по истории (undo/redo)** — undo вызывает command.undo и уменьшает currentIndex; undo при пустой истории возвращает false; undo эмитит Changed с lastUndone; redo вызывает command.execute и увеличивает currentIndex; redo при невозможности возвращает false; redo эмитит Changed с lastRedone; полный цикл A→B→undo→undo; полный цикл A→undo→redo; события keyboard:undo и keyboard:redo вызывают соответствующие методы.
- **Служебные методы** — getLastCommand; getHistoryInfo (totalCommands, currentIndex, canUndo, canRedo, commands); clear очищает историю и эмитит Changed; destroy снимает только свои подписки.

### `tests/EventBus.test.js` — 38 тестов (ранее)

### `tests/core/rendering/GeometryUtils.test.js` — 113 тестов (ранее)

### `tests/core/rendering/PixiRenderer.test.js` — 41 тестов (ранее)

### `tests/core/rendering/LayerManager.test.js` — 40 тестов (исправлены)

---

## TODO

### Обнаруженные проблемы

- [x] ~~**Текст записки не сохраняется**~~ — исправлено. `SelectTool.finalize` отправлял `updates: { content: value }` (верхний уровень) вместо `updates: { properties: { content: value } }`. Исправлено в 4 местах SelectTool.js.
- [x] ~~**Поворот записки не сохраняется**~~ — исправлено в два этапа: (1) `updateObjectRotationDirect()` теперь пишет в `object.transform.rotation`; (2) устранены runtime-падения в rotate/UI-flow (`HtmlHandlesLayer._onRotateHandleDown` и `ContextMenu.hide`), добавлены регрессионные тесты `tests/ui/HtmlHandlesLayer.rotation.test.js` и `tests/ui/ContextMenu.test.js`.
- [ ] **`_toggleColorPalette` не работает как toggle** — `NotePropertiesPanel._toggleColorPalette()` вызывает `_hideAllColorPalettes()` ДО проверки `isVisible`, из-за чего палитра всегда считается скрытой и открывается заново. Реального закрытия по повторному клику на кнопку не происходит.
- [x] ~~**`LayerManager.test.js` — 8 падающих тестов**~~ — исправлено. Код: добавлена защита `_createLayers()` от null app/stage, валидация null в `addToWorldLayer()`. Тесты: исправлены ожидания для addChild (mockClear сбрасывал счётчик), removeFromWorldLayer (children.includes проверка).

### Следующие тесты

- [x] ~~Тесты взаимодействия записки через `PlacementTool`~~ — 51 тест
- [x] ~~Тесты редактирования записки через `SelectTool`~~ — 13 тестов (onDoubleClick)
- [ ] Тесты обработки событий записки в `CoreMoodBoard` (UpdateObjectContent, StateChanged)
- [ ] Тесты `HtmlTextLayer` — отображение текста записки в HTML-слое
- [ ] Тесты `SelectTool._openTextEditor` для записки (NoteEditStart, textarea позиционирование, autoSize)
- [ ] Тесты `SelectTool._closeTextEditor` для записки (NoteEditEnd, UpdateObjectContent, showText)

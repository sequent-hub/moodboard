# Архитектура проекта `@sequent-org/moodboard`

Этот документ описывает фактическую архитектуру проекта на уровне модулей и их ответственности.

## 1. Назначение пакета

`@sequent-org/moodboard` — интерактивный редактор мудборда на базе `pixi.js`, поставляемый как библиотека.

- Точка входа пакета: `src/index.js`
- Публичный класс для использования: `MoodBoard` (`src/moodboard/MoodBoard.js`)
- Экспорт стилей: `./style.css` -> `src/ui/styles/index.css`

## 2. Архитектурные слои

Проект разделен на несколько основных слоев.

### 2.1 Public API / Facade

Файлы:
- `src/index.js`
- `src/moodboard/MoodBoard.js`
- `src/moodboard/WorkspaceManager.js`
- `src/moodboard/DataManager.js`
- `src/moodboard/ActionHandler.js`

Ответственность:
- Инициализация рабочей области в контейнере.
- Сборка и связывание `CoreMoodBoard`, UI и сервисов.
- Публичные методы управления доской (`createObject`, `deleteObject`, `clearBoard`, `exportBoard`, `destroy`, `loadFromApi`).
- Оркестрация загрузки и применения данных доски.

### 2.2 Core (ядро редактора)

Файлы:
- `src/core/index.js` (`CoreMoodBoard`)
- `src/core/EventBus.js`
- `src/core/StateManager.js`
- `src/core/HistoryManager.js`
- `src/core/SaveManager.js`
- `src/core/ApiClient.js`
- `src/core/events/Events.js`
- `src/core/commands/*`

Ответственность:
- Централизованное состояние доски и объектов.
- Шина событий (EventBus) и единый реестр имен событий.
- Undo/Redo через паттерн Command.
- Автосохранение и загрузка данных.
- Координация инструментов, рендера и сервисов.

### 2.3 Rendering (PIXI слой)

Файлы:
- `src/core/PixiEngine.js`
- `src/core/rendering/*`

Ответственность:
- Инициализация PIXI приложения.
- Управление слоями сцены (`gridLayer`, `worldLayer`).
- Создание и удаление визуальных объектов.
- Обновления размеров/контента/поворота объектов.
- Hit-test по объектам на сцене.

### 2.4 Domain Objects (типы объектов доски)

Файлы:
- `src/objects/ObjectFactory.js`
- `src/objects/FrameObject.js`
- `src/objects/ShapeObject.js`
- `src/objects/DrawingObject.js`
- `src/objects/TextObject.js`
- `src/objects/EmojiObject.js`
- `src/objects/ImageObject.js`
- `src/objects/CommentObject.js`
- `src/objects/NoteObject.js`
- `src/objects/FileObject.js`

Ответственность:
- Инкапсуляция логики конкретных типов объектов.
- Предоставление PIXI-представления через объектные классы.
- Централизованное создание инстансов через `ObjectFactory`.

### 2.5 Tools (инструменты взаимодействия)

Файлы:
- `src/tools/ToolManager.js`
- `src/tools/BaseTool.js`
- `src/tools/board-tools/*`
- `src/tools/object-tools/*`
- `src/tools/object-tools/selection/*`

Ответственность:
- Обработка пользовательского ввода (mouse/keyboard/wheel/drop/contextmenu).
- Переключение и жизненный цикл активного инструмента.
- Выделение, перемещение, resize/rotate, панорамирование, рисование, размещение объектов.

### 2.6 UI слой

Файлы:
- `src/ui/Toolbar.js`
- `src/ui/Topbar.js`
- `src/ui/ZoomPanel.js`
- `src/ui/MapPanel.js`
- `src/ui/ContextMenu.js`
- `src/ui/SaveStatus.js`
- `src/ui/HtmlTextLayer.js`
- `src/ui/HtmlHandlesLayer.js`
- `src/ui/*PropertiesPanel.js`
- `src/ui/styles/*`

Ответственность:
- Отрисовка и поведение пользовательского интерфейса.
- Передача UI-действий в ядро через EventBus.
- Отображение статуса сохранения и вспомогательных панелей.
- Работа HTML-слоев поверх canvas для текста и ручек.

### 2.7 Services (прикладные сервисы)

Файлы:
- `src/services/BoardService.js`
- `src/services/ZoomPanController.js`
- `src/services/ZOrderManager.js`
- `src/services/FrameService.js`
- `src/services/ImageUploadService.js`
- `src/services/FileUploadService.js`
- `src/services/SettingsApplier.js`
- `src/services/GridSnapResolver.js`

Ответственность:
- Изолированная бизнес-логика, не привязанная к одному UI-компоненту.
- Зум/пан, порядок слоев, логика фреймов.
- Screen-space snapping через `GridSnapResolver`.
- Загрузка изображений/файлов и применение настроек доски.

### 2.8 Grid subsystem

Файлы:
- `src/grid/GridFactory.js`
- `src/grid/BaseGrid.js`
- `src/grid/DotGrid.js`
- `src/grid/LineGrid.js`
- `src/grid/CrossGrid.js`
- `src/grid/ScreenGridPhaseMachine.js`

Ответственность:
- Создание и конфигурация сетки доски.
- Screen-grid рендер в экранных координатах на основе viewport state.
- Единая phase/state machine для dot/line/cross.
- Представление различных типов сетки.

### 2.9 Utilities и assets

Файлы:
- `src/utils/*`
- `src/assets/*`
- `public/*`

Ответственность:
- Вспомогательные функции (id, загрузчики иконок/эмодзи, style helpers).
- Иконки, emoji и статические ресурсы.

## 3. Паттерны и принципы в коде

В текущей реализации явно используются:

- **Facade**: `MoodBoard` как единая точка входа для потребителя пакета.
- **Factory**: `ObjectFactory` для создания объектов по типу.
- **Command**: `core/commands/*` + `HistoryManager` для Undo/Redo.
- **Event-driven architecture**: взаимодействие между подсистемами через `EventBus` и `Events`.

## 4. Поток инициализации

Типовой порядок запуска:

1. Потребитель создает `new MoodBoard(container, options, data)`.
2. `WorkspaceManager` строит DOM-структуру workspace.
3. `CoreMoodBoard.init()` инициализирует PIXI, инструменты, сервисы и состояние.
4. `MoodBoard` поднимает UI-компоненты и связывает их с EventBus.
5. При `autoLoad=true` вызывается загрузка данных и `DataManager.loadData(...)`.

## 5. Поток данных и событий

- UI и инструменты инициируют действия через `Events.*`.
- Ядро применяет изменения в состоянии и/или через команды.
- `PixiEngine` синхронизирует визуальный слой с состоянием объектов.
- `SaveManager` отслеживает изменения и выполняет автосохранение.
- `SaveStatus` подписывается на события сохранения и обновляет индикатор в UI.

## 6. Структура репозитория (верхний уровень)

- `src/` — исходный код библиотеки
- `tests/` — тесты (core, tools, ui, objects, services, integration)
- `public/` — публичные статические ресурсы
- `dist/` — артефакты сборки
- `package.json` — npm-метаданные, скрипты, зависимости

## 7. Тестирование

Тестовый стек по `package.json` и структуре проекта:

- `vitest`
- `jsdom`
- `@testing-library/*`

Тесты организованы по слоям в каталоге `tests/`.

## 8. Система координат и трансформаций

Подробная техническая карта координатных вычислений, передачи значений между подсистемами и ориентиры для диагностики вынесены в отдельный документ:

- `COORDINATE_SYSTEM.md`


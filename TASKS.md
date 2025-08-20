Backlog задач

Задача 1 — Добить централизацию событий до конца

Контекст: уже начата централизация имён событий в src/core/events/Events.js и частичная замена строковых литералов в модулях (BaseTool, CoreMoodBoard, Toolbar, Topbar, ZoomPanel, ContextMenu, ZoomPanController, SelectTool, PlacementTool, DrawingTool, MoodBoard, частично команды). Это уменьшает связность и упрощает рефакторинг. Нужно довести работу до конца и закрепить правила, чтобы строки не возвращались в код.

Зачем это нужно
- Единая точка правды: все имена событий в одном месте (Events.js). Проще искать и менять.
- Меньше опечаток: исчезают баги вида tool:drag:updtae вместо tool:drag:update.
- Лучшая навигация IDE: по Events.* легко находить все места использования.
- SOLID и чистая архитектура: слабая связность между отправителем/получателем, проще менять шину/нейминг.
- Подготовка к дальнейшему рефакторингу: проще вводить порты/адаптеры и слой Application без TS.

Что сделать
1) Дозакрыть замену строковых событий на константы Events.*:
   - src/core/KeyboardManager.js: заменить keyboard:*, tool:*, ui:* на Events.Keyboard.*, Events.Tool.*, Events.UI.*.
   - src/ui/MapPanel.js: заменить ui:* и tool:* на Events.UI.* и Events.Tool.* (колесо‑зум, миникарта, центрирование).
   - src/core/SaveManager.js: заменить save:*, state:changed, object:*, board:data-changed на Events.Save.*, Events.Object.*, Events.Grid.* (или Board/State — по согласованию).
   - src/tools/ToolManager.js: заменить tool:wheel:zoom на Events.Tool.WheelZoom.
   - Команды: убедиться, что object:transform:updated, object:pasted, object:deleted/created — через Events.Object.*.

2) Дополнить реестр Events при необходимости:
   - Если используется: board:export (в DataManager.exportBoardData) — добавить Events.Board.Export.
   - Проверить наличие ui:minimap:* и ui:map:toggle (часть уже есть).
   - Выровнять нейминг (например, ZoomPercent соответствует ui:zoom:percent).

3) Пройтись по тестам/скриптам: заменить строковые события на Events.*.

4) Защита от регрессий (без введения «контрактов» payload):
   - Добавить npm‑скрипт check:events, который валит CI при наличии строк в eventBus.on/emit/off.
   - Быстрый вариант через ripgrep:
     - rg "eventBus\.(on|emit|off)\('\w" src — должен возвращать пусто.
     - Подключить команду в scripts и CI.
   - (Опционально позже) ESLint правило no-restricted-syntax/кастомное: запрещать Literal в первом аргументе on/emit/off, требовать MemberExpression вида Events.*.

План выполнения
- Шаг 1. Добавить недостающие ключи в Events.js, если обнаружатся по поиску (например, Board.Export).
- Шаг 2. Механическая замена по модулям (каждый — отдельный коммит): KeyboardManager.js, MapPanel.js, SaveManager.js, ToolManager.js.
- Шаг 3. Команды/прочее: добить object:transform:updated, object:pasted по всему коду.
- Шаг 4. Тесты: адаптировать вызовы/ожидания на Events.*.
- Шаг 5. Защита: добавить npm run check:events и включить в CI.

Критерии готовности (DoD)
- rg "eventBus\.(on|emit|off)\('\w" src не возвращает результатов.
- Приложение стартует без ошибок; зум/миникарта/инструменты/сохранение работают как прежде.
- Тесты зелёные (npm run test).
- Все используемые события присутствуют в Events.js, нейминг согласован.
- В репозитории есть check:events, подключённый к CI.

Риски
- Опечатки при переносе имён: делать маленькими коммитами, локально проверять ключевые сценарии (зум, пан, выделение, сохранение).
- Расхождения в payload: сейчас не вводим контракты; позже можно добавить JSDoc typedef’ы для важных payload’ов.

Оценка
- 2–4 часа + 30–60 минут на прогон/фиксы.

Примечание
- Часть работы уже сделана. Оставшиеся файлы перечислены выше; после добавления автоматической проверки возврат строковых событий маловероятен.

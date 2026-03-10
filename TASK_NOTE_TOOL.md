# Задача: E2E-тесты и Undo/Redo для инструмента «Записка»

**Контекст:** Аналогичная работа выполнена для инструмента «Текст» (TextTool). См. `tests/image-object2/TextTool.e2e.spec.js` и секцию в `TESTS.md`.

**Цель:** Добавить E2E-тесты для записки, недостающие команды undo/redo, и обновить документацию.

---

## Действия (scope)

1. **Добавление на доску** — размещение записки через кнопку note-add (PlacementTool).
2. **Перетаскивание по доске** — MoveObjectCommand (уже есть).
3. **Вращение** — RotateObjectCommand (уже есть).
4. **Масштабирование** — ResizeObjectCommand (уже есть).
5. **Изменение текста** — требуется команда. Для текста используется `UpdateContentCommand` + событие `Object.ContentChange`. Проверить, эмитится ли `ContentChange` при закрытии редактора записки; при необходимости доработать цепочку.
6. **Изменение шрифта** — требуется команда. Панель: `NotePropertiesPanel`, эмитит `StateChanged` с `properties.fontFamily`.
7. **Изменение фона** — требуется команда. `StateChanged` с `properties.backgroundColor`.
8. **Изменение цвета текста** — требуется команда. `StateChanged` с `properties.textColor`.
9. **Изменение размера шрифта** — требуется команда. `StateChanged` с `properties.fontSize`.

---

## Референс: что сделано для Текста

- **Файлы:** `TextTool.e2e.spec.js`, `UpdateContentCommand.js`, `UpdateTextStyleCommand.js`, `ObjectLifecycleFlow.js`, `HistoryManager.js`.
- **События:** `Object.ContentChange` (objectId, oldContent, newContent) для редактирования текста; перехват `StateChanged` для fontFamily, fontSize, color, backgroundColor.
- **Команды:** `UpdateContentCommand`, `UpdateTextStyleCommand` (для `type === 'text'`).
- **Хелперы в e2e:** `createObject`, `getObjectById`, `setSelection`, `triggerUndo`, `triggerRedo`, `doubleClickObject`, `clickObject`, `getObjectCanvasCenter`.

---

## Требуемые работы для Записки

### 1. E2E-тесты

Создать `tests/image-object2/NoteTool.e2e.spec.js` по аналогии с `TextTool.e2e.spec.js`:

- Добавление записки через note-add.
- Редактирование текста (двойной клик).
- Ресайз ручками.
- Панель свойств: шрифт, размер шрифта, цвет текста, фон.
- Поворот ручкой.
- Undo/redo для каждого из действий (добавление, перетаскивание, поворот, ресайз, текст, шрифт, размер, цвет, фон).

Использовать ту же страницу `/test-moodboard.html` и хелперы. Панель записки: `.note-properties-panel` (классы/селекторы уточнить в `NotePropertiesPanel.js`).

### 2. Команды undo/redo

- **Редактирование текста:** убедиться, что при закрытии редактора записки эмитится `Object.ContentChange` и выполняется `UpdateContentCommand`. Если нет — доработать `TextInlineEditorController` / `TextEditorInteractionController` для `type === 'note'`.

- **Стиль записки:** ввести перехват `StateChanged` для `object.type === 'note'` и свойств: `fontFamily`, `fontSize`, `backgroundColor`, `textColor`. Варианты:
  - Либо команда `UpdateNoteStyleCommand` (по аналогии с `UpdateTextStyleCommand`).
  - Либо расширить `UpdateTextStyleCommand` или выделить общую `UpdateObjectStyleCommand` с параметром типа объекта.

Структура `updates` у `NotePropertiesPanel`: `{ properties: { fontFamily | fontSize | backgroundColor | textColor } }`. Для записки значения в `properties` (в отличие от текста, где fontSize/color/backgroundColor на верхнем уровне).

### 3. Merge команд

Как для текста: при быстрой смене одного свойства несколько раз команды должны объединяться. В `HistoryManager` уже вызывается `_executeCommandSafely(lastCommand)` после merge — использовать этот же паттерн.

### 4. Документация

- Обновить `TESTS.md`: добавить секцию для `NoteTool.e2e.spec.js` по образцу TextTool (что было, что сделано, покрытие).
- В тестах — краткие комментарии к каждому describe/test.

---

## Важные отличия Записки от Текста

| Аспект          | Текст                                | Записка                                      |
|-----------------|--------------------------------------|----------------------------------------------|
| Панель свойств  | `TextPropertiesPanel`                | `NotePropertiesPanel`                        |
| Класс панели    | `.text-properties-panel`            | `.note-properties-panel`                     |
| Цвет текста     | `color` (hex string)                 | `textColor` (number, hex)                     |
| Фон             | `backgroundColor` (hex/transparent)  | `backgroundColor` (number)                    |
| Хранение в state| `object.properties` / `object.*`     | `object.properties`                          |
| Кнопка тулбара  | `.moodboard-toolbar__button--text-add` | `.moodboard-toolbar__button--note`         |
| Размещение      | PlacementTool (type: 'text')         | PlacementTool (type: 'note')                  |

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования; 600+ — не расширять без причины.
- Один файл — одна ответственность.
- Новый функционал — отдельный файл.
- Перед крупным рефактором — baseline-тесты.
- Не менять контракты событий без явной необходимости.

---

## Порядок выполнения

1. Создать `NoteTool.e2e.spec.js` с тестами поведения (без undo/redo для свойств).
2. Проверить/доработать ContentChange для записки.
3. Реализовать команду(ы) для стиля записки и перехват в ObjectLifecycleFlow.
4. Добавить тесты undo/redo.
5. Обновить TESTS.md.

# Рекомендации по механизму выделения (Selection)

Документ объединяет:
- выводы из изучения текущей реализации (TASK_GROUP_SELECTION_ACTIONS.md);
- рекомендации по хорошему механизму выделения на основе практик Figma, Miro, Adobe XD, Sketch и др.

---

## 1. Краткий отчёт по текущему состоянию

### Реализовано
- **Box select** — рамка выделения, frame исключены, Ctrl/Cmd добавляет к выделению
- **Multi-select кликом** — Ctrl/Cmd + клик добавляет/снимает объект
- **Групповые операции** — move, rotate, resize, delete
- **SelectionModel** — Set для id, `computeBounds` для групповой геометрии
- **Object.Deleted** — удаление из selection при удалении объекта

### Нереализовано / проблемы
- **Select All (Ctrl+A)** — событие `Tool.SelectionAll` не обрабатывается, selection не меняется
- **Shift для multi-select** — не поддерживается (только Ctrl/Cmd)
- **GroupDeleteCommand** — N × DeleteObjectCommand вместо одной команды (опционально)
- **Cleanup подписок** — SelectTool не снимает слушателей при destroy (потенциальная утечка памяти)

---

## 2. Рекомендации по механизму выделения

### 2.1 Модификаторы (Multi-select)

| Модификатор | Поведение (рекомендация) | Текущее |
|-------------|---------------------------|---------|
| Ctrl/Cmd | Добавить/убрать объект из выделения (toggle) | ✓ Реализовано |
| Shift | Добавить объект в выделение (как Ctrl) | ✗ Не реализовано |

**Обоснование:** В Figma и Miro Shift+клик обычно добавляет в выделение. Это привычно и не конфликтует с Ctrl. В файловых менеджерах Shift = «диапазон», но на canvas чаще «добавить».

**Действие:** Добавить `event.originalEvent.shiftKey` в условие `isMultiSelect` в `SelectInputRouter.onMouseDown`.

---

### 2.2 Box select — «касание» vs «полное вхождение»

**Рекомендация:** Использовать режим «касание» (intersection) — объект выделяется, если пересекается с рамкой. Так работают Figma, Miro, Adobe XD.

**Текущее:** Реализовано через `rectIntersectsRect` — корректно.

---

### 2.3 Порог минимального размера рамки

**Текущее:** `w >= 2 && h >= 2` — защита от случайного «щёлчка».

**Рекомендация:** Оставить. В некоторых продуктах используют 4–5 px.

---

### 2.4 Производительность box select

**Проблема:** При `update(mouse)` каждый mousemove:
1. вызывается `emit('get:all:objects')` — полный обход `core.pixi.objects`;
2. выполняется `rectIntersectsRect` для каждого объекта.

При 1000+ объектах это будет тормозить.

**Рекомендации:**
- **Краткосрочно:** Throttle `update` до 16–33 ms (1–2 кадра).
- **Среднесрочно:** Пространственный индекс (quadtree/R-tree) для `getObjectsInRect` — обход только кандидатов в области.
- **Текущее:** Оставить как есть, пока объектов мало (<200).

---

### 2.5 Порядок выбранных объектов (Selection order)

**Практика:** В Figma/XD «последний выбранный» — primary — используется для выравнивания, направляющих и т.п.

**Текущее:** `SelectionModel` на базе `Set` — порядок ввода не сохраняется.

**Рекомендация:** 
- Для текущего scope порядок не обязателен.
- При необходимости: заменить `Set` на `Array` (или `Set` + отдельный массив порядка) в `SelectionModel`.
- Важно: `toArray()` должен возвращать стабильный порядок (например, z-order или порядок выбора).

---

### 2.6 Объекты внутри фреймов

**Текущее:**
- Frame исключён из box select — выделяется только кликом.
- HitTest для frame с детьми: клик внутри внутренней области → `empty` → box select.
- Объекты с `frameId` учитываются в hitTest.

**Рекомендация:** Сохранить текущую логику. Соответствует ожиданиям пользователя.

---

### 2.7 Память и lifecycle

#### 2.7.1 PIXI.Graphics для box select
**Текущее:** В `BoxSelectController.end()` — `removeChild`, `destroy()`, `null`. Корректно.

#### 2.7.2 Подписки SelectTool на EventBus
**Проблема:** `registerSelectToolCoreSubscriptions` делает `eventBus.on(...)` для:
- DuplicateReady
- GroupDuplicateReady  
- ObjectEdit
- Object.Deleted

При `destroySelectTool` вызывается только `eventBus = null` (BaseTool). Слушатели не снимаются.

**Рекомендация:** Добавить в destroy отписку:

```javascript
// В destroySelectTool или перед superDestroy:
instance.eventBus.off(Events.Tool.DuplicateReady, ...);
instance.eventBus.off(Events.Tool.GroupDuplicateReady, ...);
// и т.д.
```

Или хранить ссылки на обработчики и отписываться по ним.

#### 2.7.3 SelectionModel и удалённые объекты
**Текущее:** На `Object.Deleted` вызывается `removeFromSelection(objectId)`. Корректно.

#### 2.7.4 Stale references
**Текущее:** `initialSelectionBeforeBox` — массив id (строк). Ссылок на PIXI/объекты нет. Безопасно.

---

### 2.8 Select All (Ctrl+A)

**Рекомендация:** Реализовать обработку:

1. Добавить в `ObjectLifecycleFlow` (или отдельный flow) слушатель `Events.Tool.SelectionAll`.
2. В обработчике: `GetAllObjects` → получить ids → `selectTool.setSelection(ids)`.
3. Важно: слушатель должен вызываться только при активном select tool (проверка в Core или в обработчике).

**Альтернатива:** Реализовать прямо в `SelectionStateController.selectAll()` — emit не нужен, можно сразу вызывать `GetAllObjects` и `setSelection`. Но это свяжет controller с eventBus. Предпочтительнее отдельный слушатель в Core.

---

### 2.9 Group delete — одна команда vs N команд

**Текущее:** N × `DeleteObjectCommand` — N undo для N объектов.

**Рекомендация (опционально):**
- Ввести `GroupDeleteCommand` — одна команда, один undo восстанавливает всю группу.
- Плюсы: привычное поведение (Figma, XD).
- Минусы: доп. код, нужно обеспечить стабильность.

**Приоритет:** Ниже, чем Select All и Shift. Можно отложить.

---

### 2.10 Двойной клик — редактирование vs выделение

**Текущее:** Для text, note, file — ObjectEdit (редактирование). Для остальных — `editObject`.

**Рекомендация:** Оставить. Двойной клик не должен менять выделение, если объект уже в группе.

---

### 2.11 Escape — сброс выделения

**Текущее:** В `SelectInputRouter.onKeyDown` — `clearSelection()`.

**Рекомендация:** Оставить.

---

## 3. Итоговый чек-лист для задачи

### Высокий приоритет
- [ ] **Select All** — слушатель `Tool.SelectionAll` → GetAllObjects → setSelection(ids)
- [ ] **Shift для multi-select** — добавить shiftKey в isMultiSelect
- [ ] **E2E-тесты** — `GroupSelection.e2e.spec.js` по TASK_GROUP_SELECTION_ACTIONS.md
- [ ] **Cleanup подписок** — eventBus.off при destroy SelectTool

### Средний приоритет
- [ ] **GroupDeleteCommand** (опционально) — одна команда для группового удаления
- [ ] **Throttle box select update** — при >100 объектах

### Низкий приоритет (будущее)
- [ ] Spatial index для getObjectsInRect
- [ ] Selection order (primary object) для выравнивания и др.

---

## 4. Референс: Events и команды

| Действие | События | Команда |
|----------|---------|---------|
| Box select | start → update → end | setSelection |
| Multi-select click | handleObjectSelect | add/remove |
| Group move | GroupDragStart/Update/End | GroupMoveCommand |
| Group rotate | GroupRotateStart/Update/End | GroupRotateCommand |
| Group resize | GroupResizeStart/Update/End | GroupResizeCommand |
| Group delete | ObjectsDelete | DeleteObjectCommand × N |
| Select All | SelectionAll | (нужен слушатель) |

---

## 5. Файлы для изменений (справочно)

| Компонент | Файл | Изменения |
|-----------|------|-----------|
| Multi-select Shift | SelectInputRouter.js | isMultiSelect += shiftKey |
| Select All | ObjectLifecycleFlow.js или Core setup | Слушатель SelectionAll |
| Cleanup | SelectToolSetup.js / destroySelectTool | eventBus.off при destroy |
| Group delete | ObjectLifecycleFlow.js + GroupDeleteCommand.js | (опционально) |
| E2E | tests/image-object2/GroupSelection.e2e.spec.js | Новый файл |

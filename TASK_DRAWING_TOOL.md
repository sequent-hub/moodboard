# Задача: E2E-тесты инструмента «Рисование»

**Контекст:** Аналогичная работа выполнена для инструментов «Текст», «Записка», «Добавить картинку» и «Фигуры». См. `tests/image-object2/*.e2e.spec.js` и секции в `TESTS.md`.

**Цель:** Добавить E2E-тесты для инструмента «Рисование»: дополнительная панель, курсор, варианты карандаша и маркера, ластик; проверить, что ластик стирает и карандаш, и маркер.

---

## Действия (scope)

### 1. Дополнительная панель появляется

- Кнопка «Рисование» (`.moodboard-toolbar__button--pencil`, `type: 'custom-draw'`) при клике открывает всплывающую панель (`.moodboard-toolbar__popup--draw`).
- Панель содержит: карандаш, маркер, ластик (первый ряд), во втором ряду — варианты выбранного инструмента.

### 2. Курсор карандаша отображается

- При активации инструмента рисования (карандаш) курсор меняется на курсор карандаша (data URL SVG или crosshair).
- Курсор применяется к canvas/view при ` DrawingTool.activate()`.

### 3. Карандаш: 3 варианта

- **Тонкий чёрный** — strokeWidth: 2, color: #111827.
- **Средний красный** — strokeWidth: 4, color: #ef4444.
- **Толстый зелёный** — strokeWidth: 6, color: #16a34a.

Кнопки: `.moodboard-draw__btn--size-thin-black`, `.moodboard-draw__btn--size-medium-red`, `.moodboard-draw__btn--size-thick-green`. При выборе эмитируется `Events.Draw.BrushSet` с `mode: 'pencil'`, `width`, `color`.

### 4. Маркер: 3 варианта цветов

- **Зелёный** — #22c55e.
- **Жёлтый** — #facc15.
- **Красный** — #ef4444 или #ec4899 (в коде сейчас «розовый» marker-pink — при необходимости выровнять под «красный»).

Кнопки: `.moodboard-draw__btn--marker-green`, `.moodboard-draw__btn--marker-yellow`, `.moodboard-draw__btn--marker-pink` (или marker-red). Эмитируется `Events.Draw.BrushSet` с `mode: 'marker'`, `color`, `width: 8`.

### 5. Ластик

- Можно выбрать ластик (кнопка `.moodboard-draw__btn--eraser-tool`).
- Иконка ластика отображается (в popup и/или курсор при активном ластике).

### 6. Ластик стирает и карандаш, и маркер

- Рисунки карандашом и маркером создают объекты `type: 'drawing'` с `properties.mode: 'pencil'` или `'marker'`.
- Ластик удаляет объекты типа drawing при пересечении траектории ластика с линией.
- E2E: нарисовать карандашом → стереть ластиком; нарисовать маркером → стереть ластиком.

---

## Референс: что уже есть

### Существующие тесты

- **`tests/tools/DrawingTool.eraser.test.js`** — unit: ластик удаляет drawing при пересечении, учитывает zoom/pan.
- **`tests/image-object2/SelectTool.types-smoke.e2e.spec.js`** — smoke по типам, в т.ч. drawing (создание через API).

### Ключевые файлы

| Компонент | Файл | Назначение |
|-----------|------|------------|
| Toolbar draw | `ToolbarRenderer.js`, `ToolbarActionRouter.js`, `ToolbarPopupsController.js` | Кнопка pencil, popup, `toggleDrawPopup`, `buildDrawPresets` |
| Drawing tool | `DrawingTool.js` | Рисование, ластик, `Events.Draw.BrushSet`, `_eraserSweep` |
| Объект | `DrawingObject.js`, `ObjectFactory.js` | type: 'drawing', properties.mode: 'pencil' | 'marker' |
| Events | `Events.js` | `Draw.BrushSet: 'draw:brush:set'` |

### Структура popup

- Ряд 1: `.moodboard-draw__btn--pencil-tool`, `--marker-tool`, `--eraser-tool`.
- Ряд 2: при pencil — 3 кнопки размеров/цветов; при marker — 3 swatch; при eraser — пусто, эмитируется только BrushSet(eraser).

---

## Требуемые работы

### 1. E2E-тесты

Создать `tests/image-object2/DrawingTool.e2e.spec.js`:

1. **Панель появляется** — клик по `.moodboard-toolbar__button--pencil` → popup `.moodboard-toolbar__popup--draw` виден, содержит ряд с карандашом, маркером, ластиком.
2. **Курсор карандаша** — после выбора карандаша и клика на canvas курсор применяется (проверка через `app.view.style.cursor` или видимость элементов при рисовании).
3. **Карандаш: 3 варианта** — выбор тонкого чёрного, среднего красного, толстого зелёного; рисование штриха; проверка, что созданный drawing имеет ожидаемые strokeWidth и strokeColor.
4. **Маркер: 3 варианта** — выбор зелёного, жёлтого, красного (или текущих цветов); рисование; проверка strokeColor в объекте.
5. **Ластик: выбор и иконка** — клик по `.moodboard-draw__btn--eraser-tool` → ластик активен; иконка ластика видна в кнопке (или курсор).
6. **Ластик стирает карандаш** — нарисовать карандашом → переключиться на ластик → провести по нарисованному → объект drawing удалён.
7. **Ластик стирает маркер** — нарисовать маркером → ластик → стереть → объект удалён.

Использовать страницу `/test-moodboard.html`. Хелперы: `createObject` для предзаполнения drawing при необходимости; эмуляция mouse событий для рисования (mousedown → mousemove → mouseup).

### 2. Примечание по маркеру

Если в UI маркер имеет «розовый» вместо «красного» — оставить как есть или заменить на красный по требованию. Зафиксировать в тестах фактически доступные цвета.

### 3. Документация

- Обновить `TESTS.md`: секция `DrawingTool.e2e.spec.js`.
- Краткие комментарии к describe/test.

---

## Селекторы для E2E

- Кнопка рисования: `.moodboard-toolbar__button--pencil`
- Popup: `.moodboard-toolbar__popup--draw`
- Карандаш/маркер/ластик: `.moodboard-draw__btn--pencil-tool`, `--marker-tool`, `--eraser-tool`
- Варианты карандаша: `.moodboard-draw__btn--size-thin-black`, `--size-medium-red`, `--size-thick-green`
- Варианты маркера: `.moodboard-draw__btn--marker-yellow`, `--marker-green`, `--marker-pink`
- Canvas: `.moodboard-workspace__canvas canvas`

---

## Формат объекта drawing

```js
{
  type: 'drawing',
  properties: {
    mode: 'pencil' | 'marker',
    strokeWidth: number,
    strokeColor: number,  // hex
    points: [{ x, y }, ...]
  }
}
```

---

## Правила (AGENTS.md)

- Размер файлов: до 400 строк без обоснования; 600+ — не расширять без причины.
- Один файл — одна ответственность.
- Новый функционал — отдельный файл.
- Перед крупным рефактором — baseline-тесты.
- Не менять контракты событий без явной необходимости.
- Не выдвигать гипотез — сначала сбор информации, логирование, диагностика.
- Изменять код только после явного разрешения («можно»).

---

## Порядок выполнения

1. Изучить потоки: кнопка pencil, `toggleDrawPopup`, `buildDrawPresets`, `Events.Draw.BrushSet`, DrawingTool.
2. Создать `DrawingTool.e2e.spec.js` с тестами: панель, курсор, варианты карандаша и маркера, ластик.
3. Добавить тесты «ластик стирает карандаш» и «ластик стирает маркер».
4. Обновить `TESTS.md`.

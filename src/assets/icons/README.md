# SVG Иконки для MoodBoard

## 📁 Структура папки

Эта папка содержит SVG иконки для всех инструментов MoodBoard:

- **`/`** - Иконки для основной панели инструментов (toolbar)
- **`/topbar/`** - Иконки для верхней панели (topbar)

## 🎨 Особенности SVG иконок

- **Размер**: Все иконки имеют viewBox="0 0 20 20"
- **Цвет**: Используют `fill="currentColor"` для наследования цвета от родительского элемента
- **Стилизация**: Поддерживают CSS стили для fill, stroke, opacity
- **Масштабируемость**: Отлично выглядят на любых разрешениях экрана

## 🔧 Использование

### Основная панель инструментов (Toolbar):
```javascript
import { iconLoader } from '../utils/iconLoader.js';

// Загрузка одной иконки
const svgContent = await iconLoader.loadIcon('select');

// Загрузка всех иконок
const allIcons = await iconLoader.loadAllIcons();
```

### Верхняя панель (Topbar):
```javascript
import { TopbarIconLoader } from '../utils/topbarIconLoader.js';

const topbarIconLoader = new TopbarIconLoader();
// Иконки автоматически загружаются и добавляются в DOM как символы
```

### В HTML:
```html
<button class="moodboard-toolbar__button">
    <!-- SVG будет вставлен автоматически -->
</button>
```

## 📋 Список иконок

### Основная панель инструментов (Toolbar)

| Иконка | Файл | Описание |
|--------|------|----------|
| `select` | `select.svg` | Инструмент выделения |
| `pan` | `pan.svg` | Панорамирование |
| `text-add` | `text-add.svg` | Добавить текст |
| `note` | `note.svg` | Добавить записку |
| `image` | `image.svg` | Добавить изображение |
| `shapes` | `shapes.svg` | Геометрические фигуры |
| `pencil` | `pencil.svg` | Инструмент рисования |
| `comments` | `comments.svg` | Комментарии |
| `attachments` | `attachments.svg` | Вложения |
| `emoji` | `emoji.svg` | Эмоджи |
| `frame` | `frame.svg` | Фрейм |
| `clear` | `clear.svg` | Очистить холст |
| `undo` | `undo.svg` | Отменить действие |
| `redo` | `redo.svg` | Повторить действие |

### Верхняя панель (Topbar)

| Иконка | Файл | Описание |
|--------|------|----------|
| `grid-line` | `topbar/grid-line.svg` | Сетка с линиями |
| `grid-dot` | `topbar/grid-dot.svg` | Сетка с точками |
| `grid-cross` | `topbar/grid-cross.svg` | Сетка с крестиками |
| `grid-off` | `topbar/grid-off.svg` | Сетка выключена |
| `paint` | `topbar/paint.svg` | Палитра фона |

## 🎯 Добавление новых иконок

### Для основной панели инструментов (Toolbar):
1. Создайте SVG файл с именем `icon-name.svg`
2. Используйте viewBox="0 0 20 20"
3. Добавьте `fill="currentColor"` для основных элементов
4. Добавьте имя иконки в массив `iconNames` в `iconLoader.js`
5. Обновите массив `newTools` или `existingTools` в `Toolbar.js`

### Для верхней панели (Topbar):
1. Создайте SVG файл в папке `topbar/` с именем `icon-name.svg`
2. Используйте viewBox="0 0 18 18"
3. Добавьте `fill="currentColor"` для основных элементов
4. Добавьте иконку в `TopbarIconLoader.loadBuiltInIcons()` как fallback
5. Обновите соответствующий код в `Topbar.js`

## 💡 Советы по дизайну

- **Простота**: Иконки должны быть простыми и понятными
- **Консистентность**: Используйте единый стиль для всех иконок
- **Размер**: 
  - Основная панель: 40x40px кнопки → 20x20px иконки
  - Верхняя панель: 36x36px кнопки → 18x18px иконки
- **Цвета**: Используйте `currentColor` для автоматической адаптации к теме

## 🚀 Производительность

- Иконки кэшируются после первой загрузки
- Fallback иконки доступны при ошибках загрузки
- SVG файлы оптимизированы для веб-использования

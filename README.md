# @futurello/moodboard

Интерактивная доска настроения (MoodBoard) с готовым UI на базе PIXI.js.

## Установка

```bash
npm install @futurello/moodboard
```

## Использование

```javascript
import { MoodBoard } from '@futurello/moodboard';
import '@futurello/moodboard/style.css';

// Создание доски с автоматическим UI
const board = new MoodBoard('#container', {
    theme: 'light' // 'light' | 'dark'
});

// Готово! UI создался автоматически
```

## Возможности

- 🖼️ **Добавление рамок** - создание рамок на доске
- 📝 **Добавление текста** - размещение текстовых элементов  
- 🔶 **Добавление фигур** - создание геометрических фигур
- 🗑️ **Очистка доски** - удаление всех объектов
- 💾 **Экспорт данных** - сохранение состояния доски
- 🌙 **Темы** - светлая и темная тема
- 📱 **Адаптивность** - работает на мобильных устройствах

## API

### Создание объектов программно

```javascript
// Создание рамки
board.createObject('frame', { x: 100, y: 100 });

// Создание текста
board.createObject('simple-text', { x: 200, y: 150 });

// Создание фигуры
board.createObject('shape', { x: 300, y: 200 });
```

### Управление доской

```javascript
// Получение всех объектов
const objects = board.objects;

// Получение данных доски
const data = board.boardData;

// Удаление объекта
board.deleteObject(objectId);

// Очистка доски
board.clearBoard();

// Изменение темы
board.setTheme('dark');

// Очистка ресурсов
board.destroy();
```

### Загрузка данных

```javascript
const board = new MoodBoard('#container', 
    { theme: 'light' }, 
    {
        // Готовые объекты для загрузки
        objects: [
            { type: 'frame', position: { x: 50, y: 50 } }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
);
```

## События

```javascript
// Подписка на экспорт данных
board.coreMoodboard.eventBus.on('board:export', (data) => {
    console.log('Exported data:', data);
});
```

## Структура проекта

```
src/
├── index.js              # Главный экспорт
├── core/                 # Основная библиотека
│   ├── index.js         # CoreMoodBoard - базовый функционал
│   ├── PixiEngine.js    # PIXI.js рендеринг
│   ├── StateManager.js  # Управление состоянием
│   ├── EventBus.js      # Система событий
│   └── ApiClient.js     # HTTP запросы
├── ui/                   # UI компоненты
│   ├── MoodBoard.js     # Главный класс с UI
│   ├── Toolbar.js       # Панель инструментов
│   └── styles/          # CSS стили
├── objects/              # Объекты доски
│   ├── BaseObject.js    # Базовый класс объектов
│   ├── FrameObject.js   # Рамки
│   └── TextObject.js    # Текст
├── tools/                # Инструменты
│   ├── BaseTool.js      # Базовый инструмент
│   └── SelectTool.js    # Инструмент выделения
└── utils/                # Утилиты
    ├── colors.js        # Работа с цветами
    └── geometry.js      # Геометрические функции
```

## Технологии

- **PIXI.js** - 2D рендеринг
- **Axios** - HTTP запросы
- **Vanilla JS** - без фреймворков
- **CSS Grid/Flexbox** - адаптивная верстка

## Лицензия

MIT

## Автор

Sequent

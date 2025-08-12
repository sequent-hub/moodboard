# MoodBoard - Техническая документация

## 🏗️ Архитектура проекта

### Общая структура

```
src/
├── core/                    # Ядро системы
│   ├── ApiClient.js        # HTTP клиент для API
│   ├── EventBus.js         # Система событий
│   ├── PixiEngine.js       # Движок рендеринга PIXI.js
│   ├── StateManager.js     # Управление состоянием
│   ├── HistoryManager.js   # Undo/Redo система
│   ├── KeyboardManager.js  # Обработка клавиатуры
│   ├── SaveManager.js      # Автосохранение
│   ├── index.js           # Основной координатор
│   └── commands/          # Command Pattern для Undo/Redo
│       ├── BaseCommand.js
│       ├── CreateObjectCommand.js
│       ├── DeleteObjectCommand.js
│       ├── MoveObjectCommand.js
│       ├── ResizeObjectCommand.js
│       └── RotateObjectCommand.js
├── objects/                # Объекты доски
│   ├── BaseObject.js      # Базовый класс
│   ├── FrameObject.js     # Рамки
│   └── TextObject.js      # Текстовые объекты
├── tools/                 # Инструменты взаимодействия
│   ├── BaseTool.js        # Базовый класс инструментов
│   ├── ToolManager.js     # Менеджер инструментов
│   ├── ResizeHandles.js   # Ручки изменения размера
│   └── object-tools/      # Инструменты для объектов
│       └── SelectTool.js  # Выделение и манипуляция
├── ui/                    # Пользовательский интерфейс
│   ├── Toolbar.js         # Панель инструментов
│   ├── SaveStatus.js      # Индикатор сохранения
│   └── styles/           # CSS стили
│       └── workspace.css
├── utils/                 # Утилиты
│   ├── colors.js         # Работа с цветами
│   └── geometry.js       # Геометрические функции
├── grid/                 # Системы сетки
│   ├── BaseGrid.js       # Базовый класс сетки
│   └── GridFactory.js    # Фабрика сеток
├── moodboard/            # Главный класс приложения
│   └── MoodBoard.js      # Основной класс MoodBoard
├── lib.js                # Экспорт библиотеки
├── main.js               # Точка входа для разработки
└── index.js              # Точка входа для npm пакета
```

## 🔧 Ключевые компоненты

### 1. CoreMoodBoard (`src/core/index.js`)

Центральный координатор всей системы. Связывает все компоненты через EventBus.

```javascript
class CoreMoodBoard {
    constructor(container, options) {
        this.eventBus = new EventBus();
        this.pixi = new PixiEngine(container, options);
        this.state = new StateManager();
        this.toolManager = new ToolManager(this.eventBus);
        this.history = new HistoryManager(this.eventBus);
        this.saveManager = new SaveManager(this.eventBus, options);
        this.keyboard = new KeyboardManager(this.eventBus);
    }
}
```

**Ответственности:**
- Инициализация всех подсистем
- Связывание компонентов через события
- Обработка жизненного цикла объектов
- Координация команд Undo/Redo

### 2. PixiEngine (`src/core/PixiEngine.js`)

Движок рендеринга на базе PIXI.js.

```javascript
class PixiEngine {
    constructor(container, options) {
        this.app = new PIXI.Application({
            width: options.width || 1200,
            height: options.height || 800,
            backgroundColor: options.backgroundColor || 0xf5f5f5
        });
        this.objects = new Map(); // objectId -> PIXI.DisplayObject
    }
    
    createObject(objectData) {
        // Создание PIXI объектов по типу
        // Настройка pivot/anchor для корректного вращения
        // Обработка hit testing
    }
}
```

**Ключевые особенности:**
- Создание различных типов PIXI объектов
- Настройка центра вращения (pivot/anchor)
- Hit testing для интерактивности
- Управление z-index через `sortableChildren`

### 3. StateManager (`src/core/StateManager.js`)

Управление состоянием приложения.

```javascript
class StateManager {
    constructor() {
        this.data = {
            board: { id: null, name: 'Untitled' },
            objects: [],
            selectedObjectId: null
        };
        this.isDirty = false;
    }
}
```

**Функции:**
- Хранение данных объектов в памяти
- Отслеживание изменений (`isDirty`)
- Сериализация/десериализация для сохранения
- Управление выделением объектов

### 4. ToolManager & SelectTool

Система инструментов для взаимодействия с объектами.

```javascript
class SelectTool extends BaseTool {
    onMouseDown(event) {
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'resize-handle') {
            this.startResize(hitResult.handle, hitResult.object);
        } else if (hitResult.type === 'rotate-handle') {
            this.startRotate(hitResult.object);
        } else if (hitResult.type === 'object') {
            this.startDrag(hitResult.object);
        }
    }
}
```

**Возможности:**
- Hit testing с приоритетом (ручки > объекты > фон)
- Drag & Drop объектов
- Изменение размера через ручки
- Поворот объектов с центром в центре объекта

### 5. ResizeHandles (`src/tools/ResizeHandles.js`)

Система визуальных ручек для манипуляции объектами.

```javascript
class ResizeHandles {
    constructor(app) {
        // Контейнер для ручек (вращается с объектом)
        this.container = new PIXI.Container();
        this.container.zIndex = 1000;
        
        // Контейнер для рамки (не вращается) 
        this.borderContainer = new PIXI.Container();
        this.borderContainer.zIndex = 999;
    }
    
    updateHandles() {
        // Синхронизация поворота контейнера с объектом
        this.container.rotation = this.targetObject.rotation;
        this.container.x = this.targetObject.x;
        this.container.y = this.targetObject.y;
    }
}
```

**Архитектура:**
- **Основной контейнер** - вращается с объектом (ручки)
- **Контейнер рамки** - не вращается (рамка выделения)
- **Z-index управление** - ручки поверх всего

## 📡 Система событий

### EventBus Pattern

Центральная система событий связывает все компоненты:

```javascript
// Создание объекта
eventBus.emit('object:create', { type: 'frame', position: {x: 100, y: 100} });

// Изменение размера
eventBus.emit('object:resize', { objectId: 'obj_123', size: {width: 200, height: 150} });

// Поворот объекта  
eventBus.emit('object:rotate', { objectId: 'obj_123', angle: 45 });
```

### Ключевые события

| Событие | Описание | Данные |
|---------|----------|---------|
| `object:create` | Создание объекта | `{type, position, size, ...}` |
| `object:delete` | Удаление объекта | `{objectId}` |
| `object:select` | Выделение объекта | `{objectId}` |
| `object:move` | Перемещение | `{objectId, position}` |
| `object:resize` | Изменение размера | `{objectId, size, position}` |
| `object:rotate` | Поворот | `{objectId, angle}` |
| `tool:*` | События инструментов | Различные |
| `save:*` | События сохранения | `{status, data}` |

## 🔄 Command Pattern для Undo/Redo

### Базовая команда

```javascript
class BaseCommand {
    constructor(type, description) {
        this.type = type;
        this.description = description;
        this.timestamp = Date.now();
    }
    
    execute() { throw new Error('Must implement execute()'); }
    undo() { throw new Error('Must implement undo()'); }
    redo() { this.execute(); }
}
```

### Пример команды

```javascript
class MoveObjectCommand extends BaseCommand {
    constructor(objectId, oldPosition, newPosition, eventBus) {
        super('move', `Перемещение объекта`);
        this.objectId = objectId;
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
        this.eventBus = eventBus;
    }
    
    execute() {
        this.eventBus.emit('object:move', {
            objectId: this.objectId,
            position: this.newPosition
        });
    }
    
    undo() {
        this.eventBus.emit('object:move', {
            objectId: this.objectId, 
            position: this.oldPosition
        });
    }
}
```

### HistoryManager

```javascript
class HistoryManager {
    constructor(eventBus) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 50;
    }
    
    executeCommand(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // Очищаем redo при новой команде
    }
}
```

## 💾 Система автосохранения

### SaveManager

```javascript
class SaveManager {
    constructor(eventBus, options) {
        this.saveDelay = 2000; // 2 секунды
        this.maxRetries = 3;
        this.periodicSaveInterval = 30000; // 30 секунд
        
        this.setupEventListeners();
        this.setupPeriodicSave();
        this.setupBeforeUnload();
    }
    
    async saveData(data) {
        try {
            await this.apiClient.saveBoard(data);
            this.emit('save:success');
        } catch (error) {
            this.handleSaveError(error);
        }
    }
}
```

**Стратегии сохранения:**
- **Debounce** - задержка после изменений
- **Retry** - повторные попытки при ошибках  
- **Periodic** - периодическое сохранение
- **BeforeUnload** - сохранение при закрытии

## 🎨 Рендеринг объектов

### Типы объектов

```javascript
// Рамка - граница без заливки
createFrame(data) {
    const graphics = new PIXI.Graphics();
    graphics.lineStyle(2, 0x000000);
    graphics.drawRect(0, 0, data.size.width, data.size.height);
    return graphics;
}

// Текст - с настройкой шрифта
createText(data) {
    const text = new PIXI.Text(data.content, {
        fontSize: data.fontSize || 24,
        fill: data.color || 0x000000
    });
    text.anchor.set(0.5, 0.5); // Центр для поворота
    return text;
}

// Фигура - заливка цветом
createShape(data) {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(data.color || 0xff0000);
    graphics.drawRect(0, 0, data.size.width, data.size.height);
    return graphics;
}
```

### Настройка центра вращения

```javascript
// Для Graphics объектов
const pivotX = width / 2;
const pivotY = height / 2;
pixiObject.pivot.set(pivotX, pivotY);
pixiObject.x += pivotX; // Компенсация смещения
pixiObject.y += pivotY;

// Для Text/Sprite объектов
pixiObject.anchor.set(0.5, 0.5);
```

## 🔌 API интеграция

### ApiClient

```javascript
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.csrfToken = this.getCSRFToken();
    }
    
    async saveBoard(boardData) {
        const response = await fetch(`${this.baseUrl}/boards/${boardData.board.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken
            },
            body: JSON.stringify(boardData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return response.json();
    }
}
```

### Сериализация данных

```javascript
// Экспорт состояния
serialize() {
    return {
        board: this.data.board,
        objects: this.data.objects.map(obj => ({
            id: obj.id,
            type: obj.type,
            position: obj.position,
            size: obj.size,
            rotation: obj.rotation || 0,
            // Специфичные поля для типа
            ...(obj.type === 'text' && { 
                content: obj.content,
                fontSize: obj.fontSize,
                color: obj.color 
            })
        }))
    };
}
```

## 🎛️ Управление производительностью

### Оптимизации PIXI.js

```javascript
// Включение оптимизаций
app.stage.sortableChildren = true; // Z-index сортировка
app.renderer.plugins.interaction.resolution = 1; // Точность мыши

// Ограничение FPS для экономии ресурсов
app.ticker.maxFPS = 60;

// Кулинг для невидимых объектов
object.renderable = isVisible;
```

### Управление памятью

```javascript
// Очистка PIXI объектов
removeObject(objectId) {
    const pixiObject = this.objects.get(objectId);
    if (pixiObject) {
        pixiObject.destroy({ children: true, texture: false });
        this.objects.delete(objectId);
    }
}

// Очистка ресурсов при destroy
destroy() {
    this.app.destroy(true, { children: true, texture: true });
    this.eventBus.removeAllListeners();
}
```

## 🧪 Тестирование

### Модульные тесты

```javascript
// Пример теста для StateManager
describe('StateManager', () => {
    test('should add object', () => {
        const state = new StateManager();
        const obj = { id: 'test', type: 'frame' };
        
        state.addObject(obj);
        
        expect(state.getObjects()).toContain(obj);
        expect(state.isDirty).toBe(true);
    });
});
```

### Интеграционные тесты

```javascript
// Тест полного цикла создания объекта
test('create object workflow', async () => {
    const moodboard = new MoodBoard('#test');
    
    // Создаем объект
    moodboard.addObject({ type: 'frame', position: {x: 100, y: 100} });
    
    // Проверяем состояние
    const objects = moodboard.getObjects();
    expect(objects).toHaveLength(1);
    
    // Проверяем PIXI рендеринг
    const pixiObjects = moodboard.core.pixi.objects;
    expect(pixiObjects.size).toBe(1);
});
```

## 🔧 Отладка

### Логирование событий

```javascript
// Включение debug режима
const moodboard = new MoodBoard('#container', { 
    debug: true 
});

// Debug событий
eventBus.on('*', (eventName, data) => {
    if (DEBUG) {
        console.log(`🔥 Event: ${eventName}`, data);
    }
});
```

### Инспекция состояния

```javascript
// Глобальные debug методы
window.debugMoodBoard = {
    getState: () => moodboard.core.state.data,
    getPixiObjects: () => Array.from(moodboard.core.pixi.objects.keys()),
    getSelectedObject: () => moodboard.core.state.getSelectedObject(),
    getUndoStack: () => moodboard.core.history.undoStack.length
};
```

## 📦 Сборка и развертывание

### Конфигурация Vite

```javascript
// vite.config.js
export default defineConfig({
    // Базовая конфигурация для разработки
    // Публикуем исходный код, не собранный бандл
    build: {
        // Не создаем production build
        // Потребители используют наш source код
    }
});
```

### Package.json настройки

```json
{
    "main": "./src/index.js",
    "module": "./src/index.js", 
    "exports": {
        ".": "./src/index.js",
        "./style.css": "./src/ui/styles/workspace.css"
    },
    "files": ["src", "README.md"],
    "dependencies": {
        "axios": "^1.0.0",
        "pixi.js": ">=7.0.0"
    }
}
```

## 🚀 Расширение функциональности

### Добавление нового типа объекта

1. **Создать класс объекта:**
```javascript
// src/objects/ImageObject.js
export class ImageObject extends BaseObject {
    constructor(data) {
        super(data);
        this.imageUrl = data.imageUrl;
    }
}
```

2. **Добавить рендеринг в PixiEngine:**
```javascript
createImage(data) {
    const texture = PIXI.Texture.from(data.imageUrl);
    const sprite = new PIXI.Sprite(texture);
    sprite.width = data.size.width;
    sprite.height = data.size.height;
    return sprite;
}
```

3. **Обновить switch в createObject:**
```javascript
case 'image':
    pixiObject = this.createImage(objectData);
    break;
```

### Добавление нового инструмента

```javascript
// src/tools/board-tools/PanTool.js
export class PanTool extends BaseTool {
    constructor(eventBus) {
        super('pan', eventBus);
        this.cursor = 'grab';
    }
    
    onMouseDown(event) {
        this.cursor = 'grabbing';
        this.startPan(event.x, event.y);
    }
}
```

---

**Этот документ описывает внутреннюю архитектуру MoodBoard. Для использования библиотеки смотрите USER_GUIDE.md**

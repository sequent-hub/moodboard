# MoodBoard - Правильное закрытие и уничтожение

## Обзор

MoodBoard предоставляет метод `destroy()` для правильного закрытия и освобождения всех ресурсов. Этот метод должен вызываться при завершении работы с экземпляром MoodBoard для предотвращения утечек памяти и корректной очистки DOM элементов.

## Основной метод

### `moodboard.destroy()`

Уничтожает экземпляр MoodBoard и освобождает все связанные ресурсы.

```javascript
// Создание MoodBoard
const moodboard = new MoodBoard(container, options);

// ... работа с MoodBoard ...

// Правильное закрытие
moodboard.destroy();
```

## Что происходит при вызове destroy()

### 1. Уничтожение UI компонентов

Метод `destroy()` последовательно уничтожает все UI компоненты:

- **Toolbar** - панель инструментов
- **SaveStatus** - индикатор состояния сохранения
- **TextPropertiesPanel** - панель свойств текста
- **FramePropertiesPanel** - панель свойств фрейма
- **NotePropertiesPanel** - панель свойств заметок
- **AlignmentGuides** - направляющие выравнивания
- **CommentPopover** - всплывающие окна комментариев

### 2. Уничтожение ядра (CoreMoodBoard)

Внутренний метод `coreMoodboard.destroy()` выполняет:

- **SaveManager** - менеджер сохранения данных
- **KeyboardManager** - обработчик клавиатурных событий
- **HistoryManager** - менеджер истории действий
- **PixiEngine** - PIXI.js движок и canvas
- **EventBus** - очистка всех подписок на события

### 3. Уничтожение рабочего пространства

- **WorkspaceManager** - менеджер рабочего пространства
  - Удаление всех DOM элементов из контейнера
  - Очистка ссылок на контейнеры

## Примеры использования

### Базовое использование

```javascript
// Создание MoodBoard
const container = document.getElementById('moodboard-container');
const moodboard = new MoodBoard(container, {
    theme: 'light',
    autoSave: true
});

// ... работа с MoodBoard ...

// Закрытие при завершении работы
moodboard.destroy();
```

### Использование в React компоненте

```javascript
import { useEffect, useRef } from 'react';
import { MoodBoard } from './dist/moodboard.es.js';

function MoodBoardComponent() {
    const containerRef = useRef(null);
    const moodboardRef = useRef(null);

    useEffect(() => {
        // Создание MoodBoard при монтировании
        if (containerRef.current) {
            moodboardRef.current = new MoodBoard(containerRef.current, {
                theme: 'light'
            });
        }

        // Очистка при размонтировании
        return () => {
            if (moodboardRef.current) {
                moodboardRef.current.destroy();
                moodboardRef.current = null;
            }
        };
    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />;
}
```

### Использование в Vue компоненте

```javascript
import { onMounted, onUnmounted, ref } from 'vue';
import { MoodBoard } from './dist/moodboard.es.js';

export default {
    setup() {
        const container = ref(null);
        let moodboard = null;

        onMounted(() => {
            // Создание MoodBoard при монтировании
            if (container.value) {
                moodboard = new MoodBoard(container.value, {
                    theme: 'light'
                });
            }
        });

        onUnmounted(() => {
            // Очистка при размонтировании
            if (moodboard) {
                moodboard.destroy();
                moodboard = null;
            }
        });

        return { container };
    }
};
```

### Использование с проверкой

```javascript
// Безопасное закрытие с проверкой
function closeMoodBoard(moodboard) {
    if (moodboard && typeof moodboard.destroy === 'function') {
        try {
            moodboard.destroy();
            console.log('MoodBoard успешно закрыт');
        } catch (error) {
            console.error('Ошибка при закрытии MoodBoard:', error);
        }
    } else {
        console.warn('MoodBoard не найден или метод destroy недоступен');
    }
}

// Использование
closeMoodBoard(moodboard);
moodboard = null; // Очищаем ссылку
```

### Динамическое создание и удаление

```javascript
// Создание нового MoodBoard
function createMoodBoard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error(`Контейнер ${containerId} не найден`);
    }

    return new MoodBoard(container, {
        theme: 'light',
        autoSave: false
    });
}

// Удаление MoodBoard
function removeMoodBoard(moodboard) {
    if (moodboard) {
        moodboard.destroy();
    }
}

// Пример использования
let currentMoodBoard = null;

// Создание
currentMoodBoard = createMoodBoard('moodboard-container');

// ... работа ...

// Удаление
removeMoodBoard(currentMoodBoard);
currentMoodBoard = null;
```

## Важные предупреждения

### ⚠️ После вызова destroy()

1. **Объект MoodBoard больше не должен использоваться**
2. **Все DOM элементы удалены** из контейнера
3. **Все события отписаны** и не будут срабатывать
4. **PIXI.js приложение уничтожено**
5. **Память освобождена** от всех ресурсов

### ⚠️ Обязательные действия

```javascript
// ❌ НЕПРАВИЛЬНО - повторное использование после destroy()
moodboard.destroy();
moodboard.addObject(...); // ОШИБКА!

// ✅ ПРАВИЛЬНО - очистка ссылки после destroy()
moodboard.destroy();
moodboard = null; // Очищаем ссылку
```

### ⚠️ Проверка состояния

```javascript
// Проверка, что MoodBoard еще не уничтожен
if (moodboard && moodboard.coreMoodboard) {
    // MoodBoard активен, можно использовать
    moodboard.addObject(...);
} else {
    // MoodBoard уничтожен или не инициализирован
    console.warn('MoodBoard недоступен');
}
```

## Обработка ошибок

### Try-catch блок

```javascript
try {
    moodboard.destroy();
    console.log('MoodBoard успешно закрыт');
} catch (error) {
    console.error('Ошибка при закрытии MoodBoard:', error);
    // Дополнительная обработка ошибки
}
```

### Проверка доступности метода

```javascript
if (typeof moodboard.destroy === 'function') {
    moodboard.destroy();
} else {
    console.warn('Метод destroy недоступен');
}
```

## Лучшие практики

### 1. Всегда вызывайте destroy()

```javascript
// ✅ Хорошо - явное закрытие
const moodboard = new MoodBoard(container);
// ... работа ...
moodboard.destroy();

// ❌ Плохо - оставляем MoodBoard в памяти
const moodboard = new MoodBoard(container);
// ... работа ...
// Забыли вызвать destroy()
```

### 2. Очищайте ссылки

```javascript
// ✅ Хорошо - очистка ссылки
moodboard.destroy();
moodboard = null;

// ❌ Плохо - ссылка остается
moodboard.destroy();
// moodboard все еще ссылается на уничтоженный объект
```

### 3. Используйте в cleanup функциях

```javascript
// ✅ Хорошо - cleanup в useEffect
useEffect(() => {
    const moodboard = new MoodBoard(container);
    
    return () => {
        moodboard.destroy(); // Cleanup при размонтировании
    };
}, []);
```

### 4. Проверяйте состояние

```javascript
// ✅ Хорошо - проверка перед использованием
if (moodboard && !moodboard.destroyed) {
    moodboard.addObject(...);
}
```

## Отладка

### Логирование состояния

```javascript
// Добавление логирования в destroy()
const originalDestroy = moodboard.destroy;
moodboard.destroy = function() {
    console.log('Уничтожение MoodBoard...');
    originalDestroy.call(this);
    console.log('MoodBoard уничтожен');
};
```

### Проверка утечек памяти

```javascript
// Проверка после destroy()
moodboard.destroy();

// Проверяем, что все ссылки очищены
console.log('Container children:', container.children.length); // Должно быть 0
console.log('Event listeners:', moodboard.eventBus?.listeners?.size || 0); // Должно быть 0
```

## Исправления в версии 1.0.11

### Проблема с "висячими" обработчиками событий

В предыдущих версиях после вызова `destroy()` могли возникать ошибки в консоли из-за оставшихся обработчиков событий, которые пытались обратиться к уже уничтоженным объектам.

## Исправления в версии 1.0.13

### Проблема с отсутствующим методом destroy() в ContextMenu

В версии 1.0.11 была обнаружена ошибка: метод `MoodBoard.destroy()` пытался вызвать `this.contextMenu.destroy()`, но у объекта `ContextMenu` не было метода `destroy()`.

## Исправления в версии 1.0.14

### Проблема с "Cannot read properties of null (reading 'children')"

После исправлений в версии 1.0.13 вернулась старая ошибка: `Cannot read properties of null (reading 'children')` в методе `SelectTool.getPixiObjectAt()`. Проблема была в том, что мы добавили проверку `if (this.destroyed)`, но не добавили проверку на существование `this.resizeHandles.container` перед обращением к его свойству `children`.

## Исправления в версии 1.0.15

### Проблема с "Cannot read properties of null (reading 'children')" - продолжение

После исправлений в версии 1.0.14 ошибка все еще возникала, потому что мы исправили только одну проверку, но есть еще места в коде, где обращаемся к `this.resizeHandles.container.children` без дополнительной проверки. Проблема была в том, что между проверкой и использованием `this.resizeHandles.container` мог стать `null`.

### Внесенные исправления в версии 1.0.11:

#### 1. **Флаг состояния объекта**
- Добавлен флаг `destroyed` во все основные классы
- Предотвращает повторное уничтожение
- Блокирует выполнение методов после уничтожения

#### 2. **Проверки состояния во всех методах**
- Все публичные методы теперь проверяют флаг `destroyed`
- При попытке использования уничтоженного объекта выводится предупреждение
- Методы возвращают безопасные значения (null, 0, пустые массивы)

#### 3. **Улучшенная очистка ресурсов**
- Полная очистка всех ссылок на объекты
- Правильная отписка от всех событий
- Остановка ResizeObserver
- Очистка глобальных ссылок

#### 4. **Защита от ошибок**
- Проверки существования объектов перед обращением
- Безопасные fallback значения
- Предотвращение обращений к уничтоженным PIXI объектам

### Внесенные исправления в версии 1.0.13:

#### 1. **Добавлен метод destroy() в ContextMenu**
- Добавлен флаг `destroyed` в конструктор
- Реализован метод `destroy()` для правильной очистки DOM элементов
- Скрытие меню и удаление из DOM
- Очистка всех ссылок

#### 2. **Безопасные проверки для всех destroy() вызовов**
- Добавлен вспомогательный метод `_safeDestroy()`
- Проверка наличия метода `destroy()` перед вызовом
- Try-catch блоки для обработки ошибок при уничтожении
- Подробное логирование ошибок

#### 3. **Улучшенная обработка ошибок**
- Предупреждения вместо ошибок при отсутствии метода `destroy()`
- Детальное логирование проблем при уничтожении
- Продолжение процесса уничтожения даже при ошибках в отдельных компонентах

### Внесенные исправления в версии 1.0.14:

#### 1. **Исправлена проверка resizeHandles.container**
- Добавлена проверка `!this.resizeHandles.container` в `getPixiObjectAt()`
- Предотвращение обращения к `null.children`

#### 2. **Добавлены проверки destroyed во все методы SelectTool**
- `hitTest()` - возвращает `{ type: 'empty' }` при уничтожении
- `updateCursor()` - выходит из метода при уничтожении
- `onMouseMove()` - выходит из метода при уничтожении

#### 3. **Полная защита от null-ссылок**
- Все методы SelectTool теперь проверяют `this.destroyed`
- Безопасные fallback значения для всех методов
- Предотвращение выполнения кода после уничтожения инструмента

### Внесенные исправления в версии 1.0.15:

#### 1. **Дополнительные проверки в getPixiObjectAt()**
- Добавлена проверка `this.resizeHandles.container &&` перед обращением к `container.visible`
- Добавлена проверка `this.resizeHandles.container &&` перед сравнением с `container`
- Предотвращение обращения к `null.children` между проверкой и использованием

#### 2. **Проверки destroyed в дополнительных методах**
- `updateResizeHandles()` - выходит из метода при уничтожении
- `clearSelection()` - выходит из метода при уничтожении
- Предотвращение выполнения кода после уничтожения инструмента

#### 3. **Усиленная защита от race conditions**
- Дополнительные проверки прямо перед использованием объектов
- Предотвращение изменений состояния между проверкой и использованием
- Полная защита от null-ссылок во всех сценариях

### Результат исправлений:

```javascript
// ✅ Теперь безопасно
moodboard.destroy();
moodboard.setTheme('dark'); // Выведет предупреждение, но не вызовет ошибку
moodboard.createObject(...); // Вернет null без ошибки
```

### Тестирование исправлений:

Используйте файл `test-destroy-fix.html` для проверки корректности работы исправлений:

```bash
# Откройте в браузере
start test-destroy-fix.html
```

Тест автоматически:
1. Создает MoodBoard
2. Уничтожает его
3. Пытается вызвать методы после уничтожения
4. Симулирует события мыши
5. Мониторит ошибки в консоли

## Заключение

Метод `destroy()` является **обязательным** для правильной работы с MoodBoard. Он обеспечивает:

- ✅ Полную очистку ресурсов
- ✅ Предотвращение утечек памяти
- ✅ Корректное удаление DOM элементов
- ✅ Отписку от всех событий
- ✅ Уничтожение PIXI.js приложения
- ✅ Защиту от ошибок после уничтожения
- ✅ Безопасные fallback значения

**Всегда вызывайте `destroy()` при завершении работы с MoodBoard!**

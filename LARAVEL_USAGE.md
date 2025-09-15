# Использование MoodBoard в Laravel без сборки

Этот гайд показывает, как подключить MoodBoard в Laravel проект без использования bundler (Vite/Webpack).

## Установка

```bash
npm install moodboard-futurello
```

## Базовая настройка

### 1. Подключение в HTML

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MoodBoard в Laravel</title>
    <!-- Критичные стили (опционально, для мгновенного отображения) -->
    <script type="module">
        import { injectCriticalStyles } from './node_modules/moodboard-futurello/src/index.js';
        injectCriticalStyles();
    </script>
</head>
<body>
    <div id="moodboard-container" style="width: 100vw; height: 100vh;"></div>

    <script type="module">
        // Устанавливаем базовый путь для ресурсов
        window.MOODBOARD_BASE_PATH = './node_modules/moodboard-futurello/';
        
        import { initMoodBoardNoBundler } from './node_modules/moodboard-futurello/src/index.js';
        
        // Инициализируем MoodBoard
        initMoodBoardNoBundler('#moodboard-container', {
            theme: 'light',
            autoSave: true
        }, './node_modules/moodboard-futurello/').then(moodboard => {
            console.log('✅ MoodBoard готов к использованию!');
            
            // Можно добавить объекты программно
            // moodboard.addObject('text', { x: 100, y: 100 }, { content: 'Привет!' });
        }).catch(error => {
            console.error('❌ Ошибка инициализации MoodBoard:', error);
        });
    </script>
</body>
</html>
```

### 2. Быстрая инициализация (рекомендуется)

```html
<script type="module">
    import { quickInitMoodBoard } from './node_modules/moodboard-futurello/src/index.js';
    
    // Быстрая инициализация - пути определяются автоматически через import.meta.url
    const moodboard = quickInitMoodBoard('#moodboard-container', {
        theme: 'light',
        // Опциональный базовый путь для ассетов (если автоопределение не работает)
        emojiBasePath: new URL('./node_modules/moodboard-futurello/src/assets/emodji/', location.href).href
    });
    
    console.log('🚀 MoodBoard запущен!');
</script>
```

## Продвинутая настройка

### 3. Ручная загрузка стилей

```javascript
import { StyleLoader, MoodBoard } from './node_modules/moodboard-futurello/src/index.js';

// Загружаем стили отдельно
const styleLoader = new StyleLoader();
await styleLoader.loadAllStyles('./node_modules/moodboard-futurello/');

// Создаем MoodBoard
const moodboard = new MoodBoard('#container', { noBundler: true });
```

### 4. Laravel Blade интеграция

```php
<!-- resources/views/moodboard.blade.php -->
@extends('layouts.app')

@section('content')
<div id="moodboard-app" style="width: 100%; height: calc(100vh - 100px);"></div>

<script type="module">
    import { quickInitMoodBoard } from '{{ asset('node_modules/moodboard-futurello/src/index.js') }}';
    
    const moodboard = quickInitMoodBoard('#moodboard-app', {
        theme: 'light',
        autoSave: true,
        apiEndpoint: '{{ route('moodboard.api') }}', // Ваш API endpoint
        // Явно указываем путь к ассетам для Laravel
        emojiBasePath: '{{ asset('node_modules/moodboard-futurello/src/assets/emodji') }}/'
    });
</script>
@endsection
```

## Настройка маршрутов в Laravel

```php
// routes/web.php
Route::get('/moodboard', function () {
    return view('moodboard');
})->name('moodboard');

// API для сохранения (опционально)
Route::post('/api/moodboard/save', [MoodboardController::class, 'save'])->name('moodboard.api');
```

## Настройка ресурсов

### 1. Копирование ресурсов в public (рекомендуется)

```bash
# Создайте символические ссылки или скопируйте файлы
cp -r node_modules/moodboard-futurello/src/assets public/moodboard-assets
cp -r node_modules/moodboard-futurello/src/ui/styles public/moodboard-styles
```

Затем используйте:
```javascript
window.MOODBOARD_BASE_PATH = './moodboard-assets/';
```

### 2. Прямое использование из node_modules

Убедитесь, что ваш веб-сервер разрешает доступ к `node_modules`:

```nginx
# nginx.conf
location /node_modules {
    alias /path/to/your/project/node_modules;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Решение проблем

### Стили не загружаются
1. Проверьте `window.MOODBOARD_BASE_PATH`
2. Убедитесь, что CSS файлы доступны по HTTP
3. Используйте `injectCriticalStyles()` для базовых стилей
4. **Для панелей свойств**: критичные стили включены в `injectCriticalStyles()`, должны работать сразу

### Эмоджи не отображаются
1. Проверьте доступность папки `src/assets/emodji/`
2. Установите правильный `MOODBOARD_BASE_PATH`
3. Проверьте консоль браузера на ошибки 404

### CORS ошибки
Добавьте в ваш Laravel проект:
```php
// config/cors.php
'paths' => ['api/*', 'node_modules/*'],
```

## Пример полной интеграции

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MoodBoard в Laravel</title>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #moodboard-container { 
            width: 100vw; 
            height: 100vh; 
            position: relative;
        }
    </style>
</head>
<body>
    <div id="moodboard-container"></div>

    <script type="module">
        // Глобальные настройки
        window.MOODBOARD_BASE_PATH = './node_modules/moodboard-futurello/';
        
        // Импорты
        import { 
            quickInitMoodBoard, 
            injectCriticalStyles 
        } from './node_modules/moodboard-futurello/src/index.js';
        
        // Критичные стили для мгновенного отображения
        injectCriticalStyles();
        
        // Инициализация MoodBoard
        const moodboard = quickInitMoodBoard('#moodboard-container', {
            theme: 'light',
            autoSave: true
        }, window.MOODBOARD_BASE_PATH);
        
        // Готово!
        console.log('🎨 MoodBoard готов к использованию в Laravel!');
    </script>
</body>
</html>
```

## API интеграция

```javascript
// Подключение к Laravel API для автосохранения
const moodboard = quickInitMoodBoard('#container', {
    autoSave: true,
    saveInterval: 30000, // 30 секунд
    onSave: async (data) => {
        const response = await fetch('/api/moodboard/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify(data)
        });
        return response.ok;
    }
});
```

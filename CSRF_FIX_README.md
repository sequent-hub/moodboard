# Исправления CSRF токена

## Проблема

Ошибка `CSRF токен не найден` возникала при загрузке изображений и файлов на сервер. Проблема была в том, что сервисы `ImageUploadService` и `FileUploadService` жестко искали CSRF токен только в HTML meta теге, но в некоторых случаях токен мог отсутствовать или быть недоступным.

## Решение

Реализована гибкая система получения CSRF токена с несколькими источниками и возможностью настройки:

### 1. Множественные источники CSRF токена

Сервисы теперь ищут CSRF токен в следующем порядке приоритета:

1. **Опции сервиса** - токен, переданный при создании сервиса
2. **HTML meta тег** - `<meta name="csrf-token" content="...">`
3. **Глобальная переменная** - `window.csrfToken`
4. **Отключение CSRF** - если `requireCsrf: false`

### 2. Настройка через опции

```javascript
// Создание сервиса с CSRF токеном в опциях
const imageService = new ImageUploadService(apiClient, {
    csrfToken: 'your-csrf-token',
    requireCsrf: true, // по умолчанию
    csrfTokenSelector: 'meta[name="csrf-token"]' // по умолчанию
});

// Создание сервиса без CSRF токена (для тестирования)
const imageService = new ImageUploadService(apiClient, {
    requireCsrf: false
});
```

### 3. Обновление CoreMoodBoard

`CoreMoodBoard` теперь передает опции CSRF токена в сервисы:

```javascript
this.imageUploadService = new ImageUploadService(this.apiClient, {
    requireCsrf: this.options.requireCsrf !== false,
    csrfToken: this.options.csrfToken
});
```

## Изменения в коде

### ImageUploadService.js

- Добавлен конструктор с опциями
- Добавлен метод `_getCsrfToken()` для гибкого получения токена
- Обновлены все методы для использования нового подхода
- Улучшены сообщения об ошибках

### FileUploadService.js

- Аналогичные изменения как в `ImageUploadService`
- Поддержка всех источников CSRF токена
- Гибкая настройка через опции

### CoreMoodBoard (src/core/index.js)

- Передача опций CSRF токена в сервисы
- Поддержка настройки через опции конструктора

## Способы использования

### 1. CSRF токен в HTML

```html
<!DOCTYPE html>
<html>
<head>
    <meta name="csrf-token" content="{{ csrf_token() }}">
</head>
<body>
    <!-- Ваше приложение -->
</body>
</html>
```

### 2. CSRF токен в опциях

```javascript
const moodboard = new MoodBoard('#container', {
    csrfToken: 'your-csrf-token'
});
```

### 3. CSRF токен в глобальной переменной

```javascript
window.csrfToken = 'your-csrf-token';
const moodboard = new MoodBoard('#container');
```

### 4. Без CSRF токена (для тестирования)

```javascript
const moodboard = new MoodBoard('#container', {
    requireCsrf: false
});
```

## Тестирование

Создан тестовый файл `test-csrf-fix.html` для проверки всех сценариев:

1. **Тест с meta тегом** - проверяет получение токена из HTML
2. **Тест с опциями** - проверяет передачу токена через опции
3. **Тест с глобальной переменной** - проверяет получение из `window.csrfToken`
4. **Тест без CSRF** - проверяет работу с `requireCsrf: false`
5. **Тест ошибки** - проверяет корректную обработку отсутствия токена

## Принципы SOLID

### Single Responsibility Principle (SRP)
- `_getCsrfToken()` отвечает только за получение CSRF токена
- Каждый метод сервиса имеет четкую ответственность

### Open/Closed Principle (OCP)
- Система открыта для расширения (новые источники токена)
- Закрыта для модификации (не изменяем существующую логику)

### Liskov Substitution Principle (LSP)
- Все источники CSRF токена взаимозаменяемы
- Единый интерфейс получения токена

### Interface Segregation Principle (ISP)
- Опции CSRF токена не зависят от других настроек
- Минимальный интерфейс для настройки

### Dependency Inversion Principle (DIP)
- Сервисы зависят от абстракции (опции), а не от конкретной реализации
- Инверсия зависимости через параметры конструктора

## Рекомендации

1. **Для продакшена**: Используйте CSRF токен в HTML meta теге
2. **Для тестирования**: Используйте `requireCsrf: false` или передавайте токен в опциях
3. **Для интеграции**: Передавайте токен через опции конструктора
4. **Для отладки**: Проверяйте консоль на наличие ошибок CSRF токена

## Совместимость

Все изменения обратно совместимы:
- Существующий код продолжает работать
- Новые опции являются необязательными
- Поведение по умолчанию не изменилось

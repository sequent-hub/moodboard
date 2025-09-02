# Исправления для загрузки изображений

## Проблема

Сервер изменил формат ответа API для загрузки изображений и файлов:

### Старый формат (было):
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "url": "...",
    ...
  }
}
```

### Новый формат (стало):
```json
{
  "success": true,
  "data": {
    "imageId": "uuid-here",  // ✅ Основное поле для изображений
    "fileId": "uuid-here",   // ✅ Основное поле для файлов
    "id": "uuid-here",       // ✅ Для обратной совместимости
    "url": "...",
    ...
  },
  "message": "Изображение успешно загружено"
}
```

## Внесенные изменения

### 1. ImageUploadService.js
- **Файл**: `src/services/ImageUploadService.js`
- **Изменения**: Обновлен метод `uploadImage()` для поддержки нового поля `imageId`
- **Совместимость**: Сохранена обратная совместимость с полем `id`

```javascript
// Было:
return {
    id: result.data.id,
    url: result.data.url,
    // ...
};

// Стало:
return {
    id: result.data.imageId || result.data.id, // Используем imageId как основное поле, id для обратной совместимости
    imageId: result.data.imageId || result.data.id, // Добавляем imageId для явного доступа
    url: result.data.url,
    // ...
};
```

### 2. FileUploadService.js
- **Файл**: `src/services/FileUploadService.js`
- **Изменения**: Обновлен метод `uploadFile()` для поддержки нового поля `fileId`
- **Совместимость**: Сохранена обратная совместимость с полем `id`

```javascript
// Было:
return {
    id: result.data.id,
    url: result.data.url,
    // ...
};

// Стало:
return {
    id: result.data.fileId || result.data.id, // Используем fileId как основное поле, id для обратной совместимости
    fileId: result.data.fileId || result.data.id, // Добавляем fileId для явного доступа
    url: result.data.url,
    // ...
};
```

### 3. KeyboardManager.js
- **Файл**: `src/core/KeyboardManager.js`
- **Изменения**: Обновлены методы `_handleImageUpload()` и `_handleImageFileUpload()`
- **Детали**: Используется `uploadResult.imageId || uploadResult.id` для совместимости

### 4. ToolManager.js
- **Файл**: `src/tools/ToolManager.js`
- **Изменения**: Обновлен метод `handleDrop()` для drag-and-drop загрузки
- **Детали**: Используется `uploadResult.imageId || uploadResult.id`

### 5. PlacementTool.js
- **Файл**: `src/tools/object-tools/PlacementTool.js`
- **Изменения**: Обновлены методы размещения изображений и файлов
- **Детали**: 
  - Для изображений: `uploadResult.imageId || uploadResult.id`
  - Для файлов: `uploadResult.fileId || uploadResult.id`

## Принципы SOLID, соблюденные в исправлениях

### 1. Single Responsibility Principle (SRP)
- Каждый сервис отвечает только за свой тип файлов (ImageUploadService для изображений, FileUploadService для файлов)
- Изменения локализованы в соответствующих сервисах

### 2. Open/Closed Principle (OCP)
- Код открыт для расширения (поддержка новых полей), но закрыт для модификации (сохранена обратная совместимость)
- Использование fallback логики `||` позволяет работать с обоими форматами

### 3. Liskov Substitution Principle (LSP)
- Интерфейс ответа от серверов остается совместимым
- Клиентский код может работать с любым форматом ответа

### 4. Interface Segregation Principle (ISP)
- Каждый сервис предоставляет только необходимые методы для своего типа файлов
- Четкое разделение между ImageUploadService и FileUploadService

### 5. Dependency Inversion Principle (DIP)
- Сервисы зависят от абстракций (ApiClient), а не от конкретных реализаций
- Легко тестировать с помощью моков

## Тестирование

Создан тестовый файл `test-image-upload-fix.html` для проверки корректности исправлений:

1. **Тест ImageUploadService**: Проверяет обработку нового формата ответа с `imageId`
2. **Тест FileUploadService**: Проверяет обработку нового формата ответа с `fileId`
3. **Проверка совместимости**: Убеждается, что `imageId`/`fileId` и `id` совпадают

## Обратная совместимость

Все изменения обеспечивают обратную совместимость:
- Если сервер возвращает только `id` - код работает как раньше
- Если сервер возвращает `imageId`/`fileId` - код использует новые поля
- Fallback логика `||` гарантирует работу в любом случае

## Рекомендации для тестирования

1. **Запустите тестовый файл**: `test-image-upload-fix.html`
2. **Проверьте загрузку изображений** через различные способы:
   - Drag-and-drop
   - Вставка из буфера обмена
   - Выбор файла через диалог
3. **Проверьте загрузку файлов** аналогичными способами
4. **Убедитесь в корректности сохранения** ID в объектах

## Файлы, затронутые изменениями

- `src/services/ImageUploadService.js`
- `src/services/FileUploadService.js`
- `src/core/KeyboardManager.js`
- `src/tools/ToolManager.js`
- `src/tools/object-tools/PlacementTool.js`
- `test-image-upload-fix.html` (новый тестовый файл)
- `IMAGE_UPLOAD_FIX_README.md` (этот файл)

# Конфигурация скачивания файлов в Laravel

## Проблема скачивания файлов

Если файлы не скачиваются, проверьте следующие пункты:

### 1. Laravel FileController.php

```php
<?php
// app/Http/Controllers/FileController.php

public function download($id)
{
    try {
        $file = File::find($id);
        
        if (!$file) {
            return response()->json([
                'success' => false,
                'message' => 'Файл не найден'
            ], 404);
        }

        // Полный путь к файлу
        $filePath = storage_path('app/public/' . $file->path);
        
        // Проверяем существование файла
        if (!file_exists($filePath)) {
            \Log::error("Файл не найден на диске: {$filePath}", [
                'file_id' => $id,
                'file_path' => $file->path,
                'storage_path' => storage_path('app/public/'),
                'file_exists' => file_exists($filePath)
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Файл отсутствует на сервере'
            ], 404);
        }

        // Получаем MIME тип
        $mimeType = $file->mime_type ?: 'application/octet-stream';
        
        // Правильные заголовки для скачивания
        $headers = [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'attachment; filename="' . $file->filename . '"',
            'Content-Length' => filesize($filePath),
            'Cache-Control' => 'no-cache, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ];

        // Отдаем файл
        return response()->download($filePath, $file->filename, $headers);

    } catch (\Exception $e) {
        \Log::error("Ошибка скачивания файла {$id}: {$e->getMessage()}", [
            'exception' => $e,
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Ошибка скачивания файла: ' . $e->getMessage()
        ], 500);
    }
}
```

### 2. Проверьте символическую ссылку storage

```bash
# В корне Laravel проекта
php artisan storage:link

# Убедитесь что ссылка создана
ls -la public/storage
```

### 3. Проверьте права доступа

```bash
# Права на папки storage
chmod -R 755 storage/
chmod -R 755 public/storage/

# Для некоторых серверов может потребоваться
chown -R www-data:www-data storage/
chown -R www-data:www-data public/storage/
```

### 4. Проверьте config/filesystems.php

```php
'disks' => [
    'public' => [
        'driver' => 'local',
        'root' => storage_path('app/public'),
        'url' => env('APP_URL').'/storage',
        'visibility' => 'public',
        'throw' => false, // Добавьте эту строку
    ],
],
```

### 5. Роуты API (routes/api.php)

```php
Route::prefix('files')->group(function () {
    Route::post('/upload', [FileController::class, 'upload']);
    Route::get('/{id}', [FileController::class, 'show']);
    Route::put('/{id}', [FileController::class, 'update']);
    Route::get('/{id}/download', [FileController::class, 'download']); // ← Важно!
    Route::delete('/{id}', [FileController::class, 'destroy']);
    Route::post('/cleanup', [FileController::class, 'cleanup']);
});
```

### 6. Метод upload для корректного сохранения

```php
public function upload(Request $request)
{
    $request->validate([
        'file' => 'required|file|max:10240', // 10MB
        'name' => 'sometimes|string|max:255'
    ]);

    try {
        $uploadedFile = $request->file('file');
        $originalName = $request->input('name', $uploadedFile->getClientOriginalName());
        
        // Генерируем уникальное имя
        $filename = time() . '_' . \Str::random(10) . '.' . $uploadedFile->getClientOriginalExtension();
        
        // Сохраняем в storage/app/public/files/
        $path = $uploadedFile->storeAs('files', $filename, 'public');
        
        // Полный путь для проверки
        $fullPath = storage_path('app/public/' . $path);
        
        \Log::info("Файл сохранен: {$fullPath}", [
            'exists' => file_exists($fullPath),
            'size' => file_exists($fullPath) ? filesize($fullPath) : 0,
            'permissions' => file_exists($fullPath) ? substr(sprintf('%o', fileperms($fullPath)), -4) : null
        ]);
        
        // Создаем запись в БД
        $file = File::create([
            'name' => $originalName,
            'filename' => $filename,
            'path' => $path, // Относительный путь от storage/app/public/
            'size' => $uploadedFile->getSize(),
            'mime_type' => $uploadedFile->getMimeType(),
            'extension' => $uploadedFile->getClientOriginalExtension(),
            'hash' => hash_file('sha256', $uploadedFile->path())
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $file->id,
                'name' => $file->name,
                'url' => \Storage::url($path),
                'size' => $file->size,
                'mime_type' => $file->mime_type,
                'formatted_size' => $this->formatBytes($file->size)
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error("Ошибка загрузки файла: {$e->getMessage()}");
        
        return response()->json([
            'success' => false,
            'message' => 'Ошибка загрузки файла: ' . $e->getMessage()
        ], 500);
    }
}

private function formatBytes($bytes, $precision = 2) 
{
    $units = array('B', 'KB', 'MB', 'GB', 'TB');
    
    for ($i = 0; $bytes > 1024; $i++) {
        $bytes /= 1024;
    }
    
    return round($bytes, $precision) . ' ' . $units[$i];
}
```

### 7. Проверка работы

1. **Загрузите новый файл** через интерфейс
2. **Проверьте логи Laravel**: `tail -f storage/logs/laravel.log`
3. **Проверьте файл на диске**: 
   ```bash
   ls -la storage/app/public/files/
   ```
4. **Попробуйте скачать** файл - в консоли браузера будет детальная диагностика

### 8. Для HTTPS в продакшене

В `.env` файле:
```
APP_URL=https://yourdomain.com
```

И в web.php добавьте редирект на HTTPS:
```php
// Принудительное использование HTTPS в продакшене
if (app()->environment('production')) {
    URL::forceScheme('https');
}
```

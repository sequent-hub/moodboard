# Задание: не сохраняется поворот объектов (записки, текст, фигуры)

## Проблема

При повороте объекта на доске (записка, текст, фигура) поворот визуально применяется, но после перезагрузки страницы объект возвращается в исходное положение (0°). Клиентская часть проверена тестами — данные формируются корректно.

## Что отправляет фронтенд

**Сохранение:** `POST /api/moodboard/save`

```json
{
  "boardId": "abc-123",
  "boardData": {
    "objects": [
      {
        "id": "obj_1748...",
        "type": "note",
        "position": { "x": 100, "y": 200 },
        "width": 250,
        "height": 250,
        "properties": {
          "content": "Текст записки",
          "backgroundColor": 16775620
        },
        "transform": {
          "pivotCompensated": false,
          "rotation": 45
        }
      }
    ],
    "name": "My Board",
    "settings": { ... }
  }
}
```

Ключевое поле: **`transform.rotation`** — угол поворота в градусах. Это вложенный объект внутри каждого элемента массива `objects`.

## Что ожидает фронтенд при загрузке

**Загрузка:** `GET /api/moodboard/{boardId}` или `GET {apiUrl}/load/{boardId}`

Ожидаемый ответ:

```json
{
  "success": true,
  "data": {
    "objects": [
      {
        "id": "obj_1748...",
        "type": "note",
        "position": { "x": 100, "y": 200 },
        "width": 250,
        "height": 250,
        "properties": { ... },
        "transform": {
          "pivotCompensated": false,
          "rotation": 45
        }
      }
    ]
  }
}
```

Фронтенд читает `object.transform.rotation` при загрузке. Если поле отсутствует → объект отображается без поворота (0°).

## Что нужно проверить на бэкенде

### 1. Сохранение — приходит ли `transform` в контроллер?
В контроллере, который обрабатывает `POST /api/moodboard/save`, залогировать входящие данные одного объекта:
```php
// Laravel пример
$objects = $request->input('boardData.objects', []);
foreach ($objects as $obj) {
    if (isset($obj['transform'])) {
        Log::info('Object transform', ['id' => $obj['id'], 'transform' => $obj['transform']]);
    }
}
```

### 2. Хранение — сохраняется ли `transform` в БД?
Проверить:
- Если `objects` хранятся как JSON-столбец (`json` / `jsonb` / `text`) — `transform` должен сохраняться автоматически.
- Если объекты хранятся в отдельной таблице с колонками (`id`, `type`, `position_x`, `position_y`, ...) — **нужна колонка для `transform`** (или отдельные колонки `rotation`, `pivot_compensated`). Если колонки нет — данные теряются при записи.
- Если используется `$fillable` / `$guarded` в модели Laravel — `transform` может быть исключён.

### 3. Загрузка — возвращается ли `transform` из БД?
В контроллере загрузки проверить, что данные из БД включают `transform`:
```php
$board = Board::find($boardId);
$objects = json_decode($board->data, true)['objects'] ?? [];
foreach ($objects as $obj) {
    Log::info('Loaded object', ['id' => $obj['id'], 'transform' => $obj['transform'] ?? 'MISSING']);
}
```

### 4. Сериализация — не срезается ли `transform` при формировании ответа?
Если используется API Resource / Transformer, проверить что `transform` не отфильтровывается:
```php
// Проверить что Resource не делает whitelist полей
// Плохо:
return ['id' => $obj['id'], 'type' => $obj['type'], 'position' => $obj['position'], ...];
// Нет transform!

// Хорошо:
return $obj; // Возвращаем объект как есть
```

## Наиболее вероятные причины

1. **Нет колонки `transform` в БД** — если объекты хранятся не как JSON blob, а в нормализованной таблице.
2. **`$fillable` в модели** — `transform` не указан в списке разрешённых полей, Laravel его игнорирует.
3. **API Resource фильтрует поля** — при формировании ответа `transform` исключается из whitelist.
4. **Миграция не обновлена** — объекты раньше не поддерживали поворот, поле `transform` не было в схеме.

## Как убедиться что исправлено

1. Открыть доску, повернуть записку на заметный угол (45°, 90°).
2. Подождать автосохранение (обычно 2-3 секунды).
3. Перезагрузить страницу.
4. Записка должна сохранить свой поворот.

Дополнительно: сделать `GET /api/moodboard/{boardId}` вручную (через Postman / curl) и убедиться, что в ответе у повёрнутых объектов есть `"transform": { "rotation": ... }`.

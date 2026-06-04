# Контракт комментариев мудборда (Figma-style pins + threads)

Единый источник правды для параллельной разработки backend (Futurello), библиотеки (`@sequent-org/moodboard`) и интеграции хоста.

**Зафиксированные решения (не пересматривать):**

- Backend комментариев — только в хосте Futurello, не в пакете `futurello/moodboard`.
- Комментарии — отдельные таблицы БД Futurello; не объекты canvas, не внутри `state_json`.
- Реальное время — Reverb/Echo с первой версии.
- Якорь пина — оба режима: свободная world-точка и привязка к объекту canvas.
- Автор сообщения определяется на сервере из `Auth::id()`; клиентский `userId` — только для оптимистичного UI.

**Связь идентификаторов:**

- `boardId` мудборда = `Card::getMoodboardBoardId()` = `(string) card.id` (с поддержкой legacy-формата имени `moodboard:{boardId}:{displayName}`).
- Kanban-доска для проверки доступа: `cards.id = boardId` → `columns.board_id` → `board_user`.

---

## 1. Модель данных (DDL-уровень)

Миграции не входят в этот документ; ниже — целевая схема таблиц Futurello.

### 1.1. `moodboard_comment_threads`

Тред = пин на холсте + метаданные треда (не путать с первым сообщением).

| Колонка | Тип | Ограничения / примечания |
|---|---|---|
| `id` | bigint unsigned | PK, auto-increment |
| `board_id` | string | NOT NULL, индекс; значение = `card.id` (строка) |
| `x` | double | NOT NULL; world X якоря пина (см. §5) |
| `y` | double | NOT NULL; world Y якоря пина |
| `anchor_object_id` | string | NULL; id объекта canvas из `state_json` |
| `anchor_dx` | double | NULL; смещение от top-left объекта по X (world) |
| `anchor_dy` | double | NULL; смещение от top-left объекта по Y (world) |
| `detached` | boolean | NOT NULL, default `false` |
| `resolved_at` | timestamp | NULL |
| `resolved_by` | unsigned int | NULL, FK → `users.id` |
| `created_by` | unsigned int | NULL, FK → `users.id`; автор пина (первого сообщения) |
| `author_name` | string | NULL; fallback как в `comments.author_name` (импорт / гость) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `color` | string(7) | NULL; hex из палитры §2.10, default NULL |
| `deleted_at` | timestamp | NULL; soft-delete (`SoftDeletes`) |

**Индексы:** `(board_id)`, `(board_id, deleted_at)`, `(anchor_object_id)` — для выборки и orphan-обработки.

**Инварианты:**

- Если `anchor_object_id IS NULL` → `anchor_dx`, `anchor_dy` должны быть NULL; позиция задаётся только `x`, `y`.
- Если `anchor_object_id IS NOT NULL` и `detached = false` → актуальная world-позиция пина вычисляется на клиенте (§5); `x`, `y` в БД — кэш последней известной абсолютной позиции (для orphan и offline).
- `resolved_at IS NOT NULL` ⇔ тред resolved; `resolved_by` заполняется при resolve.

### 1.2. `moodboard_comments`

Сообщения внутри треда. Паттерн полей — как `App\Models\Card\Comment`.

| Колонка | Тип | Ограничения / примечания |
|---|---|---|
| `id` | bigint unsigned | PK |
| `thread_id` | bigint unsigned | NOT NULL, FK → `moodboard_comment_threads.id`, cascade on delete |
| `user_id` | unsigned int | NULL, FK → `users.id` |
| `author_name` | string | NULL |
| `content` | text | NOT NULL; упоминания через trait `HasMentions` (`fieldWithMentions = 'content'`) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `deleted_at` | timestamp | NULL; soft-delete |

**Индексы:** `(thread_id, deleted_at, created_at)`.

### 1.3. `moodboard_comment_user`

Read-receipts по образцу `comment_user` (`database/migrations/2025_08_04_134212_create_comment_user_table.php`).

| Колонка | Тип | Ограничения / примечания |
|---|---|---|
| `id` | bigint unsigned | PK |
| `user_id` | unsigned int | NOT NULL, FK → `users.id`, cascade |
| `comment_id` | bigint unsigned | NOT NULL, FK → `moodboard_comments.id`, cascade |
| `viewed_at` | timestamp | NULL, default CURRENT_TIMESTAMP |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Уникальность:** `(user_id, comment_id)`.

> **Новое, обоснование:** агрегированный `unread_count` на уровне треда в API вычисляется как число сообщений треда без записи в `moodboard_comment_user` для текущего пользователя. Отдельная таблица `thread_id + user_id` в v1 не вводится — достаточно per-message receipts как у карточек.

### 1.4. Правило осиротевшего пина

При удалении объекта canvas, к которому привязан тред (`anchor_object_id` совпадает, `detached = false`):

1. Тред **не удаляется**.
2. В БД фиксируются: `x`, `y` = последняя известная абсолютная world-позиция пина; `detached = true`; `anchor_object_id`, `anchor_dx`, `anchor_dy` → NULL.
3. Рассылается realtime-событие `thread.updated` (§3).

**Реализация v1 (интеграция, не блокирует параллельную разработку):** хост при `Events.Object.Deleted` из библиотеки вызывает **внутренний** серверный метод (не отдельный публичный HTTP в v1), который выполняет шаги 1–3. Публичный HTTP-эндпоинт для detach — опционально во второй фазе.

### 1.5. Связи Eloquent (ориентир для backend)

- `MoodboardCommentThread` → `hasMany(MoodboardComment)`, `belongsTo(User, 'created_by')`, `belongsTo(User, 'resolved_by')`, `SoftDeletes`, `NullableFields`.
- `MoodboardComment` → `belongsTo(MoodboardCommentThread)`, `belongsTo(User)`, `HasMentions`, `SoftDeletes`; метод `read()` — sync в `moodboard_comment_user` по образцу `Comment::read()`.
- `booted()` на создание/обновление/удаление сообщения — dispatch `MoodboardCommentEvent` (§3) + activity log по необходимости (как `Comment::booted()`).

---

## 2. HTTP-контракт

**Базовый префикс:** `/api/v2/moodboard/{boardId}/comments`  
**Auth:** middleware auth Futurello (session / Sanctum — как у остальных `/api/v2/*` хоста).  
**Content-Type:** `application/json`.

**Разрешение `boardId` → карточка и kanban-доска:**

```text
Card::query()
  ->where('id', $boardId)  // boardId = string, но сравнивается с numeric id
  ->whereHas('column', fn ($q) => $q->where('board_id', $kanbanBoardId))
```

Доступ: membership в `board_user` с `role IS NOT NULL` для kanban-доски карточки — по образцу `BoardCardCommentsController::show()` (join `cards` → `columns` → `board_user`).  
403 — пользователь не участник доски; 404 — карточка не найдена / не moodboard / не на доске пользователя.

**Нормализация контента** (как `BoardCardCommentsController::normalizeCommentContent`):

- trim + collapse whitespace после `strip_tags`;
- пустой результат → 422 `{ "message": "Comment content is empty" }`.

### 2.1. Сериализация (общие формы)

**Message** (`serializeMessage`) — на базе `serializeComment`:

```json
{
  "id": 42,
  "thread_id": 7,
  "user_id": 5,
  "author_name": "Иван Петров",
  "author_avatar": "https://example.com/avatars/5.jpg",
  "content": "<p>Текст с @упоминанием</p>",
  "created_at": "2026-06-03T12:00:00.000000Z",
  "updated_at": "2026-06-03T12:00:00.000000Z"
}
```

- `author_name` = `$comment->user?->name ?? $comment->author_name ?? null`
- `author_avatar` = `$comment->user?->avatar ?? null`
- `user_id` — int или null

**Thread** (`serializeThread`):

```json
{
  "id": 7,
  "board_id": "12345",
  "x": 640.5,
  "y": 480.25,
  "anchor_object_id": "obj-uuid-1",
  "anchor_dx": 12.0,
  "anchor_dy": -8.0,
  "detached": false,
  "color": null,
  "resolved": false,
  "resolved_at": null,
  "resolved_by": null,
  "created_by": 5,
  "author_name": "Иван Петров",
  "author_avatar": "https://example.com/avatars/5.jpg",
  "created_at": "2026-06-03T11:00:00.000000Z",
  "updated_at": "2026-06-03T12:00:00.000000Z",
  "messages_count": 3,
  "unread_count": 1
}
```

- `author_avatar` = `$thread->creator?->avatar ?? null`

**ThreadWithMessages** — `serializeThread` + вложенный блок сообщений (как `data.items` у карточных комментариев):

```json
{
  "...": "поля serializeThread",
  "messages": {
    "count": 3,
    "has_more": false,
    "items": [ "/* Message[] */" ]
  }
}
```

### 2.2. `GET /api/v2/moodboard/{boardId}/comments`

Список тредов с сообщениями, resolved-статусом, счётчиками.

**Query (опционально):**

| Параметр | Default | Описание |
|---|---|---|
| `limit` | `50` | max тредов в ответе |
| `cursor` | — | opaque cursor для следующей страницы (id треда или timestamp — на усмотрение backend, контракт: строка) |
| `messages_limit` | `20` | max сообщений на тред в ответе |
| `include_resolved` | `true` | `false` — скрыть resolved-треды |

**Response 200:**

```json
{
  "data": {
    "count": 12,
    "has_more": true,
    "cursor": "7",
    "items": [ "/* ThreadWithMessages[] */" ]
  }
}
```

- Сообщения внутри треда: `orderBy created_at ASC` (хронология треда).
- Треды: `orderBy created_at DESC` (новые пины выше) — **новое, обоснование:** Figma-style список; карточные комментарии сортировались DESC для ленты карточки, здесь первична карта.
- `messages.has_more` — если сообщений больше `messages_limit`.
- При открытии треда клиент может отметить прочитанным через отдельный вызов (§2.7).

**Ошибки:** 403 Forbidden, 404 `{ "message": "Board not found" }` / `{ "message": "Card not found" }`.

### 2.3. `POST /api/v2/moodboard/{boardId}/comments`

Создать тред-пин + первое сообщение.

**Request:**

```json
{
  "x": 640.5,
  "y": 480.25,
  "anchor_object_id": "obj-uuid-1",
  "anchor_dx": 12.0,
  "anchor_dy": -8.0,
  "content": "Первый комментарий"
}
```

| Поле | Правила |
|---|---|
| `x`, `y` | required, numeric |
| `content` | required, string, non-empty после normalize |
| `anchor_object_id` | optional, string |
| `anchor_dx`, `anchor_dy` | required_with `anchor_object_id`, numeric |

**Сервер:** `created_by = Auth::id()`, `author_name` из user; `user_id` первого сообщения = `Auth::id()`.

**Response 201:**

```json
{
  "data": {
    "thread": "/* ThreadWithMessages, messages.items.length === 1 */"
  }
}
```

**Policy:** `Gate::authorize('create', [MoodboardComment::class, $kanbanBoard])` — по образцу `CommentPolicy::create` → `$user->canEditBoardContent($board)`.

**Ошибки:** 403, 404, 422 (validation / empty content).

### 2.4. `POST /api/v2/moodboard/{boardId}/comments/{thread}/replies`

Добавить сообщение в существующий тред.

**Request:**

```json
{
  "content": "Ответ в треде"
}
```

**Response 201:**

```json
{
  "data": "/* Message */"
}
```

**Проверки:** thread принадлежит `boardId`; thread не soft-deleted.

**Ошибки:** 403, 404 `{ "message": "Thread not found" }`, 422.

### 2.5. `PATCH /api/v2/moodboard/{boardId}/comments/{thread}/resolve`

Resolve / unresolve тред.

**Request:**

```json
{
  "resolved": true
}
```

**Сервер:**

- `resolved: true` → `resolved_at = now()`, `resolved_by = Auth::id()`
- `resolved: false` → `resolved_at = null`, `resolved_by = null`

**Response 200:**

```json
{
  "data": "/* serializeThread (без messages) */"
}
```

**Policy:** `canEditBoardContent($kanbanBoard)` — любой редактор доски может resolve (как модерация треда).

**Ошибки:** 403, 404, 422 (`resolved` required boolean).

### 2.6. `PATCH /api/v2/moodboard/{boardId}/comments/{message}`

Редактировать сообщение. `{message}` = id строки `moodboard_comments`.

**Request:**

```json
{
  "content": "Исправленный текст"
}
```

**Response 200:**

```json
{
  "data": "/* Message */"
}
```

**Policy:** по образцу `CommentPolicy::update` — только автор (`user_id === Auth::id()`).

**Проверки:** message принадлежит треду с `board_id = boardId`.

**Ошибки:** 403, 404 `{ "message": "Comment not found" }`, 422.

### 2.7. `DELETE /api/v2/moodboard/{boardId}/comments/{message}`

Soft-delete сообщения.

**Response 200:**

```json
{
  "data": {
    "id": 42,
    "thread_id": 7,
    "deleted": true
  }
}
```

**Policy:** по образцу `CommentPolicy::delete` — автор или `$user->isAdminOnBoard($kanbanBoard)`.

**Ошибки:** 403, 404.

> **Новое, обоснование:** `POST .../comments/{thread}/read` для mark-as-read — опционально v1.1; в v1 read-receipts создаются при `GET` треда или явном `MoodboardComment::read()` на backend при открытии popover (хост вызывает после `Comment.ThreadOpened`). Контракт read-receipts: `syncWithoutDetaching` в `moodboard_comment_user` как `Comment::read()`.

### 2.8. Policy (ориентир)

| Действие | Правило |
|---|---|
| create thread / reply | `canEditBoardContent($board)` |
| update message | автор сообщения |
| delete message | автор **или** admin на доске |
| resolve thread | `canEditBoardContent($board)` |
| move thread pin | `canEditBoardContent($board)` |
| set thread color | `canEditBoardContent($board)` |
| delete thread | автор треда **или** admin на доске |
| list / read | участник `board_user` с role |

Класс: `App\Policies\MoodboardCommentPolicy` — зеркало `CommentPolicy`.

### 2.9. `PATCH /api/v2/moodboard/{boardId}/comments/{thread}/position`

Переместить пин треда (обновить позицию и/или привязку к объекту).

**Request:**

```json
{
  "x": 700.0,
  "y": 520.5,
  "anchor_object_id": "obj-uuid-2",
  "anchor_dx": 5.0,
  "anchor_dy": -3.0,
  "detached": false
}
```

| Поле | Правила |
|---|---|
| `x`, `y` | required, numeric |
| `anchor_object_id` | optional, string\|null |
| `anchor_dx`, `anchor_dy` | required_with `anchor_object_id`, numeric |
| `detached` | optional, boolean |

**Сервер:** обновляет `x`, `y`; при наличии `anchor_object_id` — обновляет привязку (`anchor_object_id`, `anchor_dx`, `anchor_dy`); при наличии `detached` — устанавливает флаг.

**Policy:** `canEditBoardContent($kanbanBoard)` — как resolve.

**Response 200:**

```json
{
  "data": "/* serializeThread (без messages) */"
}
```

**Ошибки:** 403, 404 `{ "message": "Thread not found" }`, 422.

---

### 2.10. `PATCH /api/v2/moodboard/{boardId}/comments/{thread}/color`

Установить или сбросить цвет пина треда.

**Request:**

```json
{
  "color": "#5B5FE9"
}
```

| Поле | Правила |
|---|---|
| `color` | present, nullable; если не null — string, один из допустимых hex: `#5B5FE9` `#1E88E5` `#00A88F` `#34A853` `#F2A600` `#F2622E` `#E5484D` `#9B51E0`; `null` — сброс цвета |

**Response 200:**

```json
{
  "data": "/* serializeThread (без messages) */"
}
```

**Policy:** `canEditBoardContent()`.

**Ошибки:** 403, 404 `{ "message": "Thread not found" }`, 422.

#### Палитра (полный список допустимых значений)

| Hex | Название |
|---|---|
| `#5B5FE9` | Индиго |
| `#1E88E5` | Синий |
| `#00A88F` | Бирюзовый |
| `#34A853` | Зелёный |
| `#F2A600` | Жёлтый |
| `#F2622E` | Оранжевый |
| `#E5484D` | Красный |
| `#9B51E0` | Фиолетовый |

---

### 2.11. `DELETE /api/v2/moodboard/{boardId}/comments/threads/{thread}`

Удалить тред вместе со всеми сообщениями (soft-delete).

**Response 200:**

```json
{
  "data": {
    "id": 7,
    "board_id": "12345",
    "deleted": true
  }
}
```

**Policy:** `Gate::authorize('deleteThread', [MoodboardComment::class, $threadModel, $board])` — автор треда (`created_by === Auth::id()`) **или** `$user->isAdminOnBoard()`.

**Поведение сервера:** soft-delete треда + всех его сообщений; broadcast `thread.deleted` (§3.3).

**Ошибки:** 403, 404 `{ "message": "Thread not found" }`.

---

## 3. Контракт реального времени

### 3.1. Канал

**Имя:** `moodboard.{boardId}` (PrivateChannel)  
**Подписка (хост):** `Echo.private(\`moodboard.${boardId}\`)` — по образцу `boardSocketListeners.js`: `Echo.private(\`board.${boardId}\`)`.

### 3.2. Авторизация канала

**Файл:** `routes/channels.php` (новая запись):

```php
Broadcast::channel('moodboard.{boardId}', function ($user, $boardId) {
    // card.id = boardId → column → board → board_user
    return /* user is member of kanban board for this moodboard card */;
});
```

Логика доступа **идентична** HTTP: membership в `board_user` для kanban-доски карточки с `id = boardId`. Не путать с каналом `board.{id}` (kanban board id).

### 3.3. Событие broadcast

**Класс:** `App\Events\MoodboardCommentEvent`  
**Интерфейс:** `ShouldBroadcastNow` — как `CardUpdateEvent`, `ColumnUpdateEvent`.  
**Канал:** `broadcastOn()` → `[new PrivateChannel("moodboard.{$boardId}")]`  
**Имя события в Echo:** `MoodboardCommentEvent` (имя класса Laravel по умолчанию).

**`broadcastWith()`:**

```json
{
  "action": "thread.created",
  "board_id": "12345",
  "thread": "/* serializeThread | null */",
  "message": "/* serializeMessage | null */",
  "changes": {}
}
```

| `action` | Когда | `thread` | `message` | `changes` |
|---|---|---|---|---|
| `thread.created` | POST create thread | ThreadWithMessages (с первым message) | первое Message | — |
| `thread.updated` | orphan detach, смена anchor cache; **перемещение пина** (PATCH .../position); **цвет** (PATCH .../color) | serializeThread | null | orphan: `{ "detached": true, "x", "y" }`; перемещение: `{ "x", "y", "anchor_object_id", "anchor_dx", "anchor_dy", "detached" }`; цвет: `{ "color": "#hex" }` |
| `thread.resolved` | PATCH resolve | serializeThread | null | `{ "resolved": bool }` |
| `comment.created` | POST reply | serializeThread (без messages) | Message | — |
| `comment.updated` | PATCH message | null | Message | — |
| `comment.deleted` | DELETE message | `{ "id", "board_id" }` | `{ "id", "thread_id", "deleted": true }` | — |
| `thread.deleted` | DELETE thread (§2.11) | `{ id, board_id }` | null | — |

### 3.4. Подписка на хосте (интеграция)

По образцу `resources/js/board/socket/boardSocketListeners.js`:

```javascript
const channel = Echo.private(`moodboard.${boardId}`);
channel.listen('MoodboardCommentEvent', (payload) => {
  moodboardInstance.comments.applyRemote(payload);
});
```

Хелпер `sc()` из `resources/js/echo.js` — для Livewire/Alpine-сайд эффектов при необходимости; библиотека получает payload через `applyRemote`.

---

## 4. Контракт библиотеки (транспорт-агностичный)

Библиотека **не** знает про Laravel, Echo, axios. Транспорт внедряет хост через options.

### 4.1. Новые options `MoodBoard`

Дополнение к существующим (`theme`, `boardId`, `apiUrl`, `autoLoad`, `onSave`, `onLoad`, `onDestroy` в `src/moodboard/MoodBoard.js`):

```typescript
{
  enableComments: boolean,           // default false
  currentUser: {
    id: number | string,
    name: string,
    avatar: string | null            // URL или null
  },
  comments: CommentsAdapter | null
}
```

`currentUser.id` — **только** для оптимистичного UI (префикс «Вы», локальная подсветка). Источник правды по авторству — поля `user_id` / `author_name` из API.

### 4.2. Интерфейс `CommentsAdapter`

Каждый метод возвращает `Promise` с формой ответа HTTP-контракта (§2).

```typescript
interface CommentsAdapter {
  loadThreads(boardId: string, params?: {
    limit?: number;
    cursor?: string;
    messages_limit?: number;
    include_resolved?: boolean;
  }): Promise<{ count: number; has_more: boolean; cursor?: string; items: ThreadWithMessages[] }>;

  createThread(boardId: string, payload: {
    x: number;
    y: number;
    anchor_object_id?: string;
    anchor_dx?: number;
    anchor_dy?: number;
    content: string;
  }): Promise<{ thread: ThreadWithMessages }>;

  addReply(boardId: string, threadId: number, content: string): Promise<Message>;

  resolveThread(boardId: string, threadId: number, resolved: boolean): Promise<Thread>;

  updateMessage(boardId: string, messageId: number, content: string): Promise<Message>;

  deleteMessage(boardId: string, messageId: number): Promise<{ id: number; thread_id: number; deleted: true }>;

  moveThread(boardId: string, threadId: number, payload: {
    x: number;
    y: number;
    anchor_object_id?: string | null;
    anchor_dx?: number | null;
    anchor_dy?: number | null;
    detached?: boolean;
  }): Promise<Thread>;

  setThreadColor(boardId: string, threadId: number, color: string): Promise<Thread>;

  deleteThread(boardId: string, threadId: number): Promise<{ id: number; deleted: true }>;
}
```

Хост реализует адаптер через `fetch`/axios к §2 и передаёт в `new MoodBoard(container, { comments: adapter, ... })`.

### 4.3. Realtime: `applyRemote`

Публичный метод инстанса (делегат в `CommentsController` / `CommentsService` библиотеки):

```javascript
moodboard.comments.applyRemote(event)
```

**`event`** — payload из `broadcastWith()` (§3.3) без изменений.

Поведение:

1. Обновить локальный store тредов/сообщений по `action`. При `thread.deleted` — удалить тред из store по `event.thread.id`, emit `Comment.ThreadDeleted`.
2. Emit `Events.Comment.RemoteUpdated` (§4.4) с `{ action, thread, message, changes }`.
3. Перепроецировать пины на canvas (§5).
4. Игнорировать эхо собственных оптимистичных операций, если `message.id` / `thread.id` уже применён (dedup по id).

Подписку на Echo выполняет **хост** (`resources/js/moodboard/index.js`), не библиотека.

### 4.4. EventBus — новые события

Объявлять **только** в `src/core/events/Events.js`, категория `Comment` (новая). Стиль имён: `comment:…` через двоеточия, как `object:created`.

```javascript
Comment: {
  PinCreated:     'comment:pin:created',
  ThreadOpened:   'comment:thread:opened',
  MessageAdded:   'comment:message:added',
  Resolved:       'comment:resolved',
  Deleted:        'comment:deleted',
  RemoteUpdated:  'comment:remote:updated',
  OpenDraftAt:    'comment:open:draft:at',
  ThreadDeleted:  'comment:thread:deleted',
}
```

Существующие события **не менять**.

| Событие | Когда emit | Payload |
|---|---|---|
| `Comment.PinCreated` | Локально создан пин (после успешного `createThread` или оптимистично до ответа) | `{ threadId: number, x: number, y: number, anchorObjectId?: string }` |
| `Comment.ThreadOpened` | UI открыл popover треда | `{ threadId: number }` |
| `Comment.MessageAdded` | Добавлено сообщение (локально или после API) | `{ threadId: number, message: Message }` |
| `Comment.Resolved` | Изменён resolved-статус | `{ threadId: number, resolved: boolean, resolvedBy?: number }` |
| `Comment.Deleted` | Удалено сообщение | `{ threadId: number, messageId: number }` |
| `Comment.RemoteUpdated` | После `applyRemote` | `{ action: string, boardId: string, thread?: object, message?: object, changes?: object }` |
| `Comment.OpenDraftAt` | UI запросил открытие нового комментария по screen-позиции | `{ screenX: number, screenY: number }` |
| `Comment.ThreadDeleted` | Тред удалён локально (`deleteThread`) или через realtime (`thread.deleted`) | `{ threadId: number }` |

**Подписки UI:** `Viewport.Changed`, `Events.Tool.PanUpdate`, `Events.UI.ZoomPercent`, `Events.Object.TransformUpdated`, `Events.Object.Deleted` — для перепроекции пинов (замена легаси `CommentPopover.reposition()`).

### 4.5. Замена легаси

- `src/objects/CommentObject.js` — визуальный прототип маркера; **не** персистится в `state_json` в новой системе.
- `src/ui/CommentPopover.js` — локальный `commentsById` Map; заменяется на thread UI с адаптером §4.2.

---

## 5. Контракт координат

### 5.1. Хранение — world-space

- `x`, `y` в `moodboard_comment_threads` — **world-координаты** (та же система, что `state.position` объектов: **top-left**, см. `COORDINATE_SYSTEM.md`).
- World-значения в БД — `double`; округление **не** применяется при сохранении.

### 5.2. Привязка к объекту

Если `anchor_object_id` задан и `detached = false`:

```text
pinWorldX = object.position.x + anchor_dx
pinWorldY = object.position.y + anchor_dy
```

`object.position` — top-left из state; при rotate/transform использовать world-трансформ PIXI-контейнера объекта (центр rotation — center объекта в PIXI, конвертация через существующий pipeline рендера).

При persist в API клиент может отправлять вычисленные `x`, `y` вместе с anchor-полями (кэш для orphan).

### 5.3. Проекция world → screen (HTML-пины и popover)

По образцу:

- `src/ui/handles/HandlesPositioningService.js` → `worldBoundsToCssRect()` (`world.toGlobal`, offset viewport).
- `src/ui/HtmlTextLayer.js` → `worldLayer.toGlobal(new PIXI.Point(x, y))`, **без** деления на `renderer.resolution`.

**Screen-space integer contract** (`.cursor/skills/verify-screen-space/SKILL.md`):

- CSS `left`, `top`, `width`, `height` overlay-пина и popover — **целые пиксели**.
- Округление `Math.round()` — **в точке формирования screen-space**, при установке `element.style.left/top` (как `CommentPopover.reposition`: `` `${Math.round(left)}px` ``).
- Проверка: `npm run test:screen:integer`.

### 5.4. Перепроекция

Пересчитывать screen-позиции пинов при:

- `Events.Viewport.Changed`
- `Events.Tool.PanUpdate`
- `Events.UI.ZoomPercent`
- resize окна / canvas
- `Events.Object.TransformUpdated` — для пинов с anchor на этот objectId

---

## 6. Что переиспользуем из существующего кода

| Область | Путь | Что берём |
|---|---|---|
| Модель комментария | `Futurello/app/Models/Card/Comment.php` | Поля `user_id`, `author_name`, `content`; `SoftDeletes`, `HasMentions`, `NullableFields`; `read()` / `getViews()` → `moodboard_comment_user`; `booted()` → broadcast + activity |
| REST + serialize | `Futurello/app/Http/Controllers/BoardCardCommentsController.php` | `serializeComment` → `serializeMessage`; `normalizeCommentContent`; доступ через `board_user`; структура `{ data: { count, has_more, items } }`; коды 403/404/422 |
| Policy | `Futurello/app/Policies/CommentPolicy.php` | create / update / delete / admin rules |
| Broadcast | `Futurello/app/Events/CardUpdateEvent.php`, `ColumnUpdateEvent.php` | `ShouldBroadcastNow`, `PrivateChannel`, `broadcastWith()` |
| Echo подписка | `Futurello/resources/js/board/socket/boardSocketListeners.js` | `Echo.private(...)`, `.listen('EventClass', handler)`, switch по activity/action |
| Echo init | `Futurello/resources/js/echo.js` | Reverb config, хелпер `sc()` |
| boardId | `Futurello/app/Models/Card/Card.php` → `getMoodboardBoardId()` | `boardId = (string) card.id` |
| EventBus реестр | `MoodBoard_Front/src/core/events/Events.js` | Стиль имён, категории; добавить `Comment.*` |
| Координаты overlay | `MoodBoard_Front/src/ui/handles/HandlesPositioningService.js` | `worldBoundsToCssRect`, `getViewportOffsets` |
| HTML overlay | `MoodBoard_Front/src/ui/HtmlTextLayer.js` | `toGlobal` для world→screen |
| Options facade | `MoodBoard_Front/src/moodboard/MoodBoard.js` | Расширение `this.options` |
| Легаси (заменить) | `MoodBoard_Front/src/objects/CommentObject.js`, `src/ui/CommentPopover.js` | UX-референс popover reposition + pin marker |
| UI треда (образец) | `MoodBoard_Front/src/ui/chat/ChatMessageList.js` | Лента сообщений: render списка, автоскролл, роли |
| UI ввода (образец) | `MoodBoard_Front/src/ui/chat/ChatComposer.js` | Textarea + submit, Enter без Shift |
| Read-receipts DDL | `Futurello/database/migrations/2025_08_04_134212_create_comment_user_table.php` | pivot `user_id`, `comment_id`, `viewed_at` |
| Add-event skill | `MoodBoard_Front/.cursor/skills/add-event/SKILL.md` | Правила регистрации EventBus |
| Screen integer skill | `MoodBoard_Front/.cursor/skills/verify-screen-space/SKILL.md` | Округление в точке проекции |
| Хост moodboard | `Futurello/resources/js/moodboard/index.js` | Точка wiring: `apiUrl: '/api/v2/moodboard'`, Echo, adapter |
| Canvas API | `MoodBoard_Back` (пакет) | **Не** использовать для комментариев; только canvas persistence |

---

## Приложение A. Чек-лист согласованности (для ревью PR)

- [ ] `boardId` в HTTP, WS и БД — строка `card.id`
- [ ] Доступ HTTP и WS — один и тот же join `board_user`
- [ ] Формы `serializeMessage` / `ThreadWithMessages` совпадают в REST и `broadcastWith`
- [ ] `applyRemote(event)` принимает payload без трансформации
- [ ] EventBus: только новые `Comment.*`, строки в `Events.js`
- [ ] Screen-позиции пинов — integer после проекции
- [ ] Orphan: `detached=true`, тред не удаляется
- [ ] Автор на сервере — `Auth::id()`, не из тела запроса
- [ ] `author_avatar` присутствует в `serializeThread` и `serializeMessage` (REST и broadcast)
- [ ] Позиция пина персистится через `PATCH .../position`, рассылается как `thread.updated`

---

## Приложение B. Сводный реестр имён

### HTTP-эндпоинты

1. `GET    /api/v2/moodboard/{boardId}/comments`
2. `POST   /api/v2/moodboard/{boardId}/comments`
3. `POST   /api/v2/moodboard/{boardId}/comments/{thread}/replies`
4. `PATCH  /api/v2/moodboard/{boardId}/comments/{thread}/resolve`
5. `PATCH  /api/v2/moodboard/{boardId}/comments/{message}`
6. `DELETE /api/v2/moodboard/{boardId}/comments/{message}`
7. `PATCH  /api/v2/moodboard/{boardId}/comments/{thread}/position`
8. `PATCH  /api/v2/moodboard/{boardId}/comments/{thread}/color`
9. `DELETE /api/v2/moodboard/{boardId}/comments/threads/{thread}`

### WebSocket

- **Канал:** `moodboard.{boardId}` (PrivateChannel)
- **Laravel-событие:** `MoodboardCommentEvent`
- **Значения `action`:** `thread.created`, `thread.updated`, `thread.resolved`, `thread.deleted`, `comment.created`, `comment.updated`, `comment.deleted`

### EventBus (библиотека)

- `comment:pin:created` — `Comment.PinCreated`
- `comment:thread:opened` — `Comment.ThreadOpened`
- `comment:message:added` — `Comment.MessageAdded`
- `comment:resolved` — `Comment.Resolved`
- `comment:deleted` — `Comment.Deleted`
- `comment:remote:updated` — `Comment.RemoteUpdated`
- `comment:open:draft:at` — `Comment.OpenDraftAt`
- `comment:thread:deleted` — `Comment.ThreadDeleted`

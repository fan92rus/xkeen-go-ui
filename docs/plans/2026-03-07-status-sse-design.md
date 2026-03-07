# Design: SSE для статуса XKeen

**Дата:** 2026-03-07
**Статус:** Approved

## Проблема

Текущая реализация статуса XKeen использует HTTP polling — фронтенд запрашивает `/api/xkeen/status` только при действиях пользователя (start/stop). Нет автоматического обновления статуса.

## Решение

Использовать Server-Sent Events (SSE) для стриминга статуса с бэкенда:
- Периодическая проверка статуса каждые 5 секунд
- Мгновенная проверка после команд start/stop/restart
- Автоматический reconnect браузером

## Требования

| Параметр | Значение |
|----------|----------|
| Интервал проверки | 5 секунд |
| Протокол | SSE (text/event-stream) |
| Endpoint | `/api/xkeen/status/stream` |
| Реакция на start/stop | Мгновенная проверка |

## Архитектура

```
Frontend                          Backend
   |                                 |
   |--- GET /api/xkeen/status/stream (SSE) --->
   |                                 |
   |<-- event: status {"running":true, ...} <--
   |        (каждые 5 сек)           |
   |                                 |
   |--- POST /api/xkeen/start --->   |
   |                                 |--- xkeen -start
   |                                 |--- xkeen -status (мгновенно)
   |<-- event: status {"running":true} <--
   |                                 |
```

## Backend

### Endpoint

```
GET /api/xkeen/status/stream
```

Response headers:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Event format:
```
event: status
data: {"running":true,"last_check":"2026-03-07T12:00:00Z"}

```

### Изменения в service.go

1. Добавить `StatusStream()` handler:
   - Установить SSE headers
   - Цикл с `time.NewTicker(5 * time.Second)`
   - Flush после каждого события
   - Обработка disconnect через `r.Context().Done()`

2. Добавить broadcast механизм:
   - Канал для сигнала мгновенной проверки
   - При `TriggerStatusCheck()` сбросить ticker и сразу проверить

3. Модифицировать `Start()`, `Stop()`, `Restart()`:
   - После выполнения команды вызвать `TriggerStatusCheck()`

## Frontend

### Новый сервис: services/status.js

```javascript
export function connectStatusStream(onStatus) {
    const es = new EventSource('/api/xkeen/status/stream');
    es.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        onStatus(data.running ? 'running' : 'stopped');
    });
    es.onerror = () => { /* auto-reconnect браузером */ };
    return () => es.close();
}
```

### Изменения в store.js

1. Убрать `fetchServiceStatus()` метод
2. Добавить подключение SSE в `init()`:
   ```javascript
   init() {
       this.loadFiles();
       this.loadXraySettings();
       this.checkUpdate();
       // Новое:
       connectStatusStream((status) => {
           this.serviceStatus = status;
       });
   }
   ```
3. Убрать вызовы `fetchServiceStatus()` из `startService()`, `stopService()`

### Изменения в xkeen.js

Убрать `getStatus()` — больше не нужен.

## Файлы

| Файл | Действие |
|------|----------|
| `internal/handlers/service.go` | Добавить SSE handler, broadcast, trigger |
| `internal/server/server.go` | Регистрация route `/api/xkeen/status/stream` |
| `web/static/js/services/status.js` | Создать — SSE клиент |
| `web/static/js/store.js` | Использовать SSE |
| `web/static/js/services/xkeen.js` | Удалить `getStatus()` |

## Что не меняется

- `/api/xkeen/status` HTTP endpoint — остаётся для совместимости
- WebSocket `/ws/logs` — не трогаем
- UI в `index.html` — `$store.app.serviceStatus` работает как раньше

## Обработка ошибок

- SSE disconnect: браузер автоматически reconnect
- Ошибка проверки статуса: отправить `{"running":false,"error":"..."}`
- Context cancellation: корректно закрыть соединение при shutdown сервера

# Design: Локализация CDN пакетов

**Дата:** 2026-03-08
**Статус:** Approved

## Проблема

Фронтенд приложения загружает JavaScript-библиотеки из CDN (esm.sh):
- CodeMirror 6 (редактор кода)
- Alpine.js (реактивность)

Это создает проблемы:
1. Нет интернета = нет UI
2. Задержка загрузки
3. Зависимость от внешнего сервиса

## Решение

Скачать ESM-бандлы с esm.sh и разместить локально в `web/static/vendor/`.

### Структура файлов

```
xkeen-go/web/static/vendor/
├── codemirror/
│   └── 6.0.1/
│       └── index.js              # Бандл codemirror
├── @codemirror/
│   ├── lang-json/6.0.1/index.js
│   ├── theme-one-dark/6.1.2/index.js
│   ├── merge/6.0.0/index.js
│   ├── state/6.4.1/index.js
│   └── view/6.26.3/index.js
└── alpinejs/
    └── 3.14.3/
        └── index.js
```

### Изменения в index.html

Обновить importmap на локальные пути:

```html
<script type="importmap">
{
    "imports": {
        "codemirror": "/static/vendor/codemirror/6.0.1/index.js",
        "@codemirror/lang-json": "/static/vendor/@codemirror/lang-json/6.0.1/index.js",
        "@codemirror/theme-one-dark": "/static/vendor/@codemirror/theme-one-dark/6.1.2/index.js",
        "@codemirror/merge": "/static/vendor/@codemirror/merge/6.0.0/index.js",
        "@codemirror/state": "/static/vendor/@codemirror/state/6.4.1/index.js",
        "@codemirror/view": "/static/vendor/@codemirror/view/6.26.3/index.js"
    }
}
</script>
```

Alpine.js импорт:

```javascript
import Alpine from '/static/vendor/alpinejs/3.14.3/index.js';
```

### Скачивание бандлов

esm.sh с параметром `?bundle` включает все зависимости в один файл:

```bash
# CodeMirror core
curl -L "https://esm.sh/codemirror@6.0.1?bundle" -o codemirror/6.0.1/index.js

# CodeMirror плагины
curl -L "https://esm.sh/@codemirror/lang-json@6.0.1?bundle" -o @codemirror/lang-json/6.0.1/index.js
curl -L "https://esm.sh/@codemirror/theme-one-dark@6.1.2?bundle" -o @codemirror/theme-one-dark/6.1.2/index.js
curl -L "https://esm.sh/@codemirror/merge@6.0.0?bundle" -o @codemirror/merge/6.0.0/index.js
curl -L "https://esm.sh/@codemirror/state@6.4.1?bundle" -o @codemirror/state/6.4.1/index.js
curl -L "https://esm.sh/@codemirror/view@6.26.3?bundle" -o @codemirror/view/6.26.3/index.js

# Alpine.js
curl -L "https://esm.sh/alpinejs@3.14.3?bundle" -o alpinejs/3.14.3/index.js
```

### static.go

Файлы автоматически включатся в `//go:embed web` — изменений не требуется.

## Влияние на размер бинаря

Ориентировочные размеры бандлов:
- CodeMirror + плагины: ~300-500 KB
- Alpine.js: ~50 KB

Итого: +350-550 KB к размеру бинаря.

## Альтернативы

1. **npm + бандлер** — более профессионально, но добавляет сложность сборки
2. **UMD бандлы** — потребует переписать импорты

## Критерии успеха

- [ ] Приложение работает без интернета
- [ ] Размер бинаря увеличился допустимо
- [ ] Все функции редактора работают корректно

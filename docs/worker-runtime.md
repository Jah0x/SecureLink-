# Worker runtime notes

- Рефакторинг запуска сервера: теперь Hono-воркер монтируется до раздачи статики.
- Включён нативный `dynamic import` вместо `require` для ESM-модулей.
- Сборка: `tsc` → `tsc-alias` → `vite build`.
- Docker образ содержит только runtime-зависимости и `dist`.
- CI собирает и тестирует worker, пушит теги `latest` и `sha-<commit>`.

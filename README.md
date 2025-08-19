# SecureLink VPN

Проект обеспечивает личный кабинет для управления VPN-сервисом. Аутентификация может выполняться локально через SQLite/argon2 или проксироваться во внешний сервис. Статические файлы обслуживаются через `@hono/node-server/serve-static`. Приложение устанавливает HttpOnly-куку сессии на домен `.zerologsvpn.com`.

## Запуск в разработке

```bash
npm install
npm run dev
```

Команда `npm run dev` одновременно стартует Hono API и Vite‑сервер на порту `5173`. Все запросы фронтенда направляются на тот же домен, поэтому куки сессии сохраняются корректно.

## Проверки

```bash
npm run build && npm run smoke:head
```

## Установка

Запустите скрипт `install.sh`, который установит зависимости и подготовит окружение:

```bash
./install.sh
```

## Конфигурация

Перед запуском задайте переменные окружения:

- `AUTH_MODE` – `internal` (по умолчанию) или `proxy`
- `AUTH_BASE_URL` – базовый URL сервиса авторизации для режима `proxy`
- `AUTH_PATH_REGISTER` – путь регистрации (по умолчанию `/users/register`)
- `AUTH_PATH_LOGIN` – путь входа (по умолчанию `/users/login`)
- `AUTH_PATH_ME` – путь профиля пользователя (по умолчанию `/users/me`)
- `AUTH_PATH_LOGOUT` – путь выхода (по умолчанию `/users/logout`)
- `SESSION_COOKIE_NAME` – имя HttpOnly‑куки сессии
- `SESSION_COOKIE_DOMAIN` – домен для установки куки (если не задан, куки ставится на текущий хост)
- `SESSION_COOKIE_SECURE` – флаг `Secure`
- `SESSION_COOKIE_SAMESITE` – политика `SameSite`
- `SESSION_COOKIE_MAXAGE` – время жизни куки в секундах
- `SESSION_SECRET` – секрет подписи JWT‑сессии
- `ADMIN_EMAILS` – список e-mail администраторов через запятую
- `FIRST_USER_ADMIN` – если `true`, первый зарегистрированный пользователь становится администратором
- `NEXT_PUBLIC_API_BASE_URL` – базовый URL API (обычно `https://dashboard.securesoft.dev`)
- `PUBLIC_APP_ORIGIN` – базовый origin приложения для генерации публичных ссылок (обязателен)
- `DB` – строка подключения к базе данных (`postgresql://` или `sqlite:///`)
- `FIRST_ADMIN_EMAIL` и `FIRST_ADMIN_PASSWORD` – учётные данные первого администратора; запись создаётся автоматически, если таблица `users` пустая
- `SKIP_RUNTIME_MIGRATIONS` – пропустить миграции при старте (обычно `1` в проде)
- `MIGRATE_ON_BOOT` – выполнить миграции и сиды при старте (`0` по умолчанию)

Проект ожидает, что в каталоге `public/` будут размещены локальные иконки и изображения для Open Graph. Из-за политики репозитория бинарные файлы не хранятся в Git, поэтому добавьте собственные изображения перед деплоем.

## Миграции БД

```bash
npm run db:gen   # генерация SQL из схемы
npm run db:push  # применение миграций
```

Если при выполнении миграций появляется ошибка `Error please install required packages: drizzle-orm`, запустите `npm install` — пакет `drizzle-orm` должен присутствовать в `node_modules`.

При старте контейнера `bootstrap.sh` также выполняет `drizzle-kit push`, поэтому недостающие миграции накатываются автоматически.

## Тарифные планы и API

Схема таблицы `plans`:

- `id BIGSERIAL PRIMARY KEY`
- `name TEXT NOT NULL`
- `price NUMERIC(12,2) NOT NULL`
- `period_days INTEGER NOT NULL`
- `traffic_mb INTEGER NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

API возвращает объекты вида `{ id, name, price, periodDays, trafficMb, active, createdAt, updatedAt }`. Публичный список доступен по `GET /api/pricing`, админский CRUD работает через `/api/admin/plans`.

Для обновления старой схемы выполните вручную:

```bash
psql "$DB" < sql/migrations/2025-08-fix-plans.sql
```

## Сидер администратора

Миграции и сидер `seedFirstAdmin` выполняются только если при старте установлено `MIGRATE_ON_BOOT=1`. Если таблица `users` пуста, создаётся администратор из переменных `FIRST_ADMIN_EMAIL` и `FIRST_ADMIN_PASSWORD`. Повторные запуски сидера не создают дубликатов.

### Пример `.env`

```env
DB=postgresql://securelink:password@postgres:5432/securelink?sslmode=disable
AUTH_MODE=internal
#SESSION_COOKIE_DOMAIN=.zerologsvpn.com # оставьте закомментированным для localhost
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=None
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=change_me
```

## Kubernetes

Манифест для развертывания находится в каталоге `k8s/`. Примените его командой:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
```

В манифесте настроены liveness/readiness‑пробы на `GET /healthz` порта `5173`, Service типа `NodePort` пробрасывает порт `30082` на тот же порт контейнера.

`bootstrap.sh` из ConfigMap автоматически прогоняет миграции командой `npx -y drizzle-kit@latest push --config ./drizzle.config.ts || true` и стартует приложение через `npm run start` (`exec npm run start`), поэтому повторные рестарты узла не приводят к ошибкам из-за отсутствующих таблиц.

## Смоук‑тесты

1. `curl -i http://<nodeIP>:30082/healthz` – должен вернуть 200.
2. `curl -i -X POST http://<nodeIP>:30082/api/auth/login -d '{"email":"user@example.com","password":"pass"}' -H 'Content-Type: application/json'` – при успехе устанавливается кука `session_token`.
3. `curl -i --cookie "session_token=<token>" http://<nodeIP>:30082/api/users/me` – должен вернуть 200 и данные пользователя.

Логи приложения выводятся в STDOUT, ошибки маршрутов снабжены подробными сообщениями.

## Фичефлаги

- `FEATURE_REFERRALS` / `VITE_FEATURE_REFERRALS` — включает раздел партнёрской системы (страница «Заработок» и вкладка админки). По умолчанию `true`.

## Пользовательские тексты

Основные тексты интерфейса хранятся в компонентах React (`src/react-app/components` и `src/pages`). Их можно редактировать и собирать проект заново.

## SEO/OG статические файлы в `public`

Иконки, изображения для Open Graph и другие статические файлы нужно разместить в каталоге `public/`. Они не хранятся в репозитории и должны быть добавлены перед деплоем.

## Логи разработки

Все заметки по изменениям фиксируются в файле `docs/development-log.md`.

# SecureLink VPN

Проект обеспечивает личный кабинет для управления VPN-сервисом. Аутентификация выполняется через собственный сервис по email и паролю. Статические файлы обслуживаются через `@hono/node-server/serve-static`. Приложение проксирует запросы `/api/auth/*` и `/api/users/me`, устанавливая HttpOnly-куку сессии на домен `.zerologsvpn.com`.

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

- `AUTH_BASE_URL` – базовый URL сервиса авторизации
- `AUTH_PATH_REGISTER` – путь регистрации (по умолчанию `/users/register`)
- `AUTH_PATH_LOGIN` – путь входа (по умолчанию `/users/login`)
- `AUTH_PATH_ME` – путь профиля пользователя (по умолчанию `/users/me`)
- `AUTH_PATH_LOGOUT` – путь выхода (по умолчанию `/users/logout`)
- `SESSION_COOKIE_NAME` – имя HttpOnly‑куки сессии
- `SESSION_COOKIE_DOMAIN` – домен для установки куки (обычно `.zerologsvpn.com`)
- `SESSION_COOKIE_SECURE` – флаг `Secure`
- `SESSION_COOKIE_SAMESITE` – политика `SameSite`
- `SESSION_COOKIE_MAXAGE` – время жизни куки в секундах
- `NEXT_PUBLIC_API_BASE_URL` – базовый URL API (обычно `https://dashboard.zerologsvpn.com`)

Проект ожидает, что в каталоге `public/` будут размещены локальные иконки и изображения для Open Graph. Из-за политики репозитория бинарные файлы не хранятся в Git, поэтому добавьте собственные изображения перед деплоем.

## Kubernetes

Манифест для развертывания находится в каталоге `k8s/`. Примените его командой:

```bash
kubectl apply -f k8s/deployment.yaml
```

В манифесте настроены liveness/readiness‑пробы на `GET /healthz` порта `5173`, Service типа `NodePort` пробрасывает порт `30082` на тот же порт контейнера.

## Смоук‑тесты

1. `curl -i http://<nodeIP>:30082/healthz` – должен вернуть 200.
2. `curl -i -X POST http://<nodeIP>:30082/api/auth/login -d '{"email":"user@example.com","password":"pass"}' -H 'Content-Type: application/json'` – при успехе устанавливается кука `session_token`.
3. `curl -i --cookie "session_token=<token>" http://<nodeIP>:30082/api/users/me` – должен вернуть 200 и данные пользователя.

Логи приложения выводятся в STDOUT, ошибки маршрутов снабжены подробными сообщениями.

## Логи разработки

Все заметки по изменениям фиксируются в файле `docs/development-log.md`.

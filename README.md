# SecureLink VPN

Проект обеспечивает личный кабинет для управления VPN-сервисом. Аутентификация выполняется через собственный сервер Hunko. Статические файлы обслуживаются через `@hono/node-server/serve-static`.

## Запуск в разработке

```bash
npm install
npm run dev
```

Команда `npm run dev` одновременно стартует Hono API и Vite‑сервер на порту `5173`.
Все запросы фронтенда направляются на тот же домен, поэтому куки сессии сохраняются корректно.

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

- `HUNKO_USERS_SERVICE_API_URL` – внутренний адрес сервиса аутентификации Hunko
- `HUNKO_USERS_SERVICE_API_KEY` – ключ доступа к сервису аутентификации
- `HUNKO_SESSION_TOKEN_COOKIE_NAME` – имя HttpOnly‑куки сессии
- `NEXT_PUBLIC_API_BASE_URL` – базовый URL API (обычно `https://dashboard.zerologsvpn.com`)
- `NEXT_PUBLIC_HANKO_API_URL` – публичный URL сервиса Hanko (тот же домен, что и фронтенд)

Проект ожидает, что в каталоге `public/` будут размещены локальные иконки и изображения для Open Graph.
Из-за политики репозитория бинарные файлы не хранятся в Git, поэтому добавьте собственные изображения перед деплоем.

## Как это работает на одном домене

Все запросы приходят на `https://dashboard.zerologsvpn.com`. HAProxy направляет
путь `/thirdparty/callback` в публичное API Hanko, а остальные — в это приложение
(Vite + Hono). Благодаря единому домену HttpOnly‑куки сессии автоматически
доступны как фронтенду, так и API, без дополнительных настроек CORS.

## Kubernetes

Манифест для развертывания находится в каталоге `k8s/`. Примените его командой:

```bash
kubectl apply -f k8s/deployment.yaml
```

В манифесте настроены liveness/readiness‑пробы на `GET /healthz` порта `5173`,
Service типа `NodePort` пробрасывает порт `30082` на тот же порт контейнера.

## Смоук‑тесты

1. `curl -i http://<nodeIP>:30082/healthz` – должен вернуть 200.
2. `curl -i "http://<nodeIP>:30082/thirdparty/google/redirect_url?redirect_url=https%3A%2F%2Fdashboard.zerologsvpn.com%2Fthirdparty%2Fcallback"` – в ответе JSON с полем `redirectUrl` на `accounts.google.com`.
3. `curl -i "https://dashboard.zerologsvpn.com/thirdparty/google/redirect_url?redirect_url=https%3A%2F%2Fdashboard.zerologsvpn.com%2Fthirdparty%2Fcallback"` – то же самое через HAProxy.
4. После получения кода от Google отправить `POST https://dashboard.zerologsvpn.com/api/sessions` с `{ "code": "<полученный код>" }`, затем `GET https://dashboard.zerologsvpn.com/api/users/me` – должен вернуть 200 и данные пользователя.

Логи приложения выводятся в STDOUT, ошибки маршрутов `/thirdparty/*` и `/api/sessions` снабжены подробными сообщениями.

## Логи разработки

Все заметки по изменениям фиксируются в файле `docs/development-log.md`.

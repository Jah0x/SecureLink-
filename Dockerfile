# ===== build stage =====
FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# сборка + проверки алиасов и импорта воркера
RUN npm run build && npm run check:aliases && npm run check:worker

# ===== runtime stage =====
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
# создаём non-root пользователя и выдаём права на /app
RUN useradd -ms /bin/bash appuser \
 && mkdir -p /app/data \
 && chown -R appuser:appuser /app
USER appuser

COPY --chown=appuser:appuser --from=builder /app/node_modules /app/node_modules
COPY --chown=appuser:appuser --from=builder /app/dist /app/dist

EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD node -e "fetch('http://127.0.0.1:5173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node","dist/server/index.js"]


# ---- build ----
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5173 \
    MIGRATE_ON_BOOT=0
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
EXPOSE 5173
CMD ["node", "dist/server/index.js"]

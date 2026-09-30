# Build context: the repository root (see docker-compose.yml).
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY tests/e2e/package.json tests/e2e/
RUN npm ci -w apps/worker
COPY apps/worker apps/worker
RUN npm run build -w apps/worker

FROM node:24-bookworm-slim
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY tests/e2e/package.json tests/e2e/
RUN npm ci -w apps/worker --omit=dev
COPY --from=build /app/apps/worker/dist apps/worker/dist
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]

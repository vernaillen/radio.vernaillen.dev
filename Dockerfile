# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:26-slim AS build
WORKDIR /app

# No python3/make/g++ here, unlike vernaillen.dev: that image needs a node-gyp
# fallback for better-sqlite3 (via @nuxt/content). This app has no native deps,
# so the toolchain would only slow the build down.

# Pin pnpm to match the packageManager field (corepack lags behind).
RUN npm i -g pnpm@10.13.1

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm i --frozen-lockfile
RUN pnpm build
RUN test -f .output/server/index.mjs

# --- Runtime stage ---
FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/.output ./.output

EXPOSE 3000
# node -e fetch instead of curl/wget — node:26-slim ships neither, and Coolify
# needs an in-image HEALTHCHECK to report container health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Drop root privileges — node:26-slim ships a built-in non-root `node` user (UID 1000)
USER node
CMD ["node", ".output/server/index.mjs"]

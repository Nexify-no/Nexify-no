# nexify-ai — multi-stage image.
#
#   builder  → installs all deps and produces dist/ (client + server bundle)
#   migrator → keeps drizzle-kit available to run `drizzle-kit migrate` as a
#              SEPARATE one-shot job (never at app start). See docker-compose.yml.
#   runtime  → slim production image: prod deps only, no drizzle-kit, non-root.
#
# The runtime container does NOT touch the database schema on boot, so a restart
# can never alter the DB. Migrations are applied by the `migrate` service exactly
# once per deploy, before the app starts.

# ---- Builder: full deps + build ----------------------------------------------
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- Migrator: forward-only migrations, run as a standalone job ---------------
# Usage (CI/CD or compose): `drizzle-kit migrate` applies pending migrations from
# drizzle/ against DATABASE_URL. Idempotent and history-based (rollback-friendly).
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

# ---- Runtime: slim, production-only, non-root --------------------------------
FROM node:20-slim AS runtime
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only (no drizzle-kit / build tooling).
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Built artifacts only.
COPY --from=builder /app/dist ./dist

# Drop privileges — run as the built-in non-root `node` user.
USER node

EXPOSE 5000

# Real liveness check against the app's own /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the server ONLY — never migrate here.
CMD ["node", "dist/index.js"]

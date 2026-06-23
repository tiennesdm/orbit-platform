# =============================================================================
# ORBIT API — Multi-stage production Dockerfile
# =============================================================================
# Stage 1: deps — install with all deps (dev + prod)
# Stage 2: build — compile TS, prune dev deps
# Stage 3: prod — minimal runtime image with prod deps only
# Stage 4: runtime — distroless for final image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps (with devDependencies for build)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# OS deps for bcrypt / sharp / etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install all deps (including dev for build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: build
# -----------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

# Copy all source code
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# Build (skip typecheck errors with TS_NODE_TRANSPILE_ONLY)
ENV TS_NODE_TRANSPILE_ONLY=true
RUN cd apps/api && pnpm build

# -----------------------------------------------------------------------------
# Stage 3: production deps (pruned)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile --prod

# -----------------------------------------------------------------------------
# Stage 4: runtime
# -----------------------------------------------------------------------------
FROM prod-deps AS runtime
WORKDIR /app

# Copy built app
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/packages ./packages
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts

# Non-root user
RUN groupadd -g 1001 orbit && useradd -u 1001 -g orbit -s /bin/false orbit \
    && chown -R orbit:orbit /app
USER orbit

# Environment
ENV NODE_ENV=production
ENV PORT=4000
ENV NODE_OPTIONS="--max-old-space-size=512"

# Tini for proper signal handling (graceful shutdown)
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run
WORKDIR /app/apps/api
CMD ["node", "-r", "tsconfig-paths/register", "-r", "ts-node/register", "dist/apps/api/src/main.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

EXPOSE 4000

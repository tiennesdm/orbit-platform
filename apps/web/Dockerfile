# =============================================================================
# ORBIT Web (Next.js) — Multi-stage production Dockerfile
# =============================================================================

# Stage 1: deps
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc* ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN cd apps/web && pnpm build

# Stage 3: prod deps
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile --prod

# Stage 4: runtime
FROM prod-deps AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=384"

# Non-root user
RUN groupadd -g 1001 orbit && useradd -u 1001 -g orbit -s /bin/false orbit \
    && chown -R orbit:orbit /app
USER orbit

ENTRYPOINT ["/usr/bin/tini", "--"]
WORKDIR /app/apps/web
CMD ["pnpm", "start"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

EXPOSE 3000

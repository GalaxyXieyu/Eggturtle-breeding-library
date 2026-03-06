ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .eslintrc.base.cjs ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN pnpm --filter @eggturtle/shared build \
  && pnpm --filter @eggturtle/api build \
  && pnpm --filter @eggturtle/web build \
  && pnpm --filter @eggturtle/admin build

FROM ${NODE_IMAGE} AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

WORKDIR /app

COPY --from=builder /app /app

RUN chmod +x /app/scripts/start-node-stack.sh

EXPOSE 80

CMD ["/app/scripts/start-node-stack.sh"]

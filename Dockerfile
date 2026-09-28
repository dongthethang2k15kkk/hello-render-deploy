# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN npm run db:generate && npm run build
# public is optional in this repository.
RUN mkdir -p public

# Run this target as a one-off job against a configured PostgreSQL database.
FROM dependencies AS migration
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# Self-contained Prisma CLI (with all transitive deps such as effect, c12, ...)
# installed in its own folder so it never conflicts with the Next.js standalone node_modules.
# The version is read from package-lock.json so it always matches @prisma/client.
FROM base AS prisma-cli
WORKDIR /prisma-cli
COPY package-lock.json /tmp/package-lock.json
RUN PRISMA_VERSION="$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
  && echo "Installing prisma@${PRISMA_VERSION}" \
  && echo '{"name":"prisma-cli","private":true}' > package.json \
  && npm install --no-audit --no-fund --omit=dev --save-exact "prisma@${PRISMA_VERSION}" \
  && node node_modules/prisma/build/index.js --version

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Generated Prisma client + engines used by the app at runtime
COPY --from=dependencies --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=dependencies --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Full Prisma CLI used only for "migrate deploy" at startup
COPY --from=prisma-cli --chown=node:node /prisma-cli ./prisma-cli
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node scripts/start-container.mjs ./scripts/start-container.mjs
USER node
EXPOSE ${PORT:-3000}
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-container.mjs"]
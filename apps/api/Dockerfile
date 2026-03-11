FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── Dependencies ──────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN npm ci --workspace=apps/api --workspace=packages/db --workspace=packages/types --workspace=packages/config

# ── Development ───────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ── Builder ───────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx --workspace=packages/db prisma generate
RUN npx --workspace=apps/api nest build

# ── Production ────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/db/prisma ./prisma
EXPOSE 3001
USER node
CMD ["node", "dist/apps/api/src/main"]

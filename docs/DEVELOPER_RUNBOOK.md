# DELViON Health — Developer Runbook

> Global Diagnostic SaaS Platform · Turborepo Monorepo · Next.js 14 + NestJS + Prisma

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First-Time Setup](#first-time-setup)
3. [Daily Developer Workflow](#daily-developer-workflow)
4. [Command Reference](#command-reference)
5. [Architecture & Module Guide](#architecture--module-guide)
6. [API Authentication Flow](#api-authentication-flow)
7. [Database Operations](#database-operations)
8. [Environment Reference](#environment-reference)
9. [Common Issues & Fixes](#common-issues--fixes)
10. [Branding & Design Tokens](#branding--design-tokens)

---

## Prerequisites

| Tool | Required Version | Install |
|------|-----------------|---------|
| Node.js | ≥ 20.x | https://nodejs.org |
| npm | ≥ 10.x | bundled with Node |
| Docker Desktop | Latest | https://docker.com |
| Git | Latest | https://git-scm.com |

---

## First-Time Setup

```bash
# 1. Clone the repo and install dependencies
git clone <repo-url> devlon
cd devlon
npm install --legacy-peer-deps

# 2. Copy env file
cp .env.example .env.local
# Edit .env.local — at minimum set JWT_SECRET (≥32 chars)

# 3. Start infrastructure
npm run docker:up
# Wait ~30s for postgres/redis health checks to pass

# 4. Run database migrations
npm run db:migrate     # creates delvion_dev schema

# 5. Seed demo data
npm run db:seed
# Output: DELViON Health seed complete! 10 users, 20 tests, 10 patients, 3 orders

# 6. Start all apps in dev mode
npm run dev
```

After `npm run dev`:
- **Web UI**: http://localhost:3000
- **API**:    http://localhost:3001
- **Swagger**: http://localhost:3001/api/docs
- **MailHog**: http://localhost:8025
- **MinIO**:  http://localhost:9001

---

## Daily Developer Workflow

```bash
# Pull latest changes
git pull origin main

# Ensure infra is running
npm run docker:up

# Start dev servers (hot-reload enabled)
npm run dev

# If schema changed, regenerate Prisma client
npm run db:generate

# Run linting
npm run lint

# Run type checks
npm run type-check
```

---

## Command Reference

### Root-level Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps (Turborepo parallel dev) |
| `npm run build` | Production build of all apps |
| `npm run lint` | ESLint all packages |
| `npm run type-check` | TypeScript type-check all packages |
| `npm run clean` | Delete all dist/ and node_modules |
| `npm run docker:up` | Start full infra stack (detached) |
| `npm run docker:down` | Stop infra containers |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio at :5555 |

### App-level Commands

```bash
# NestJS API
cd apps/api
npm run build          # tsc compile → dist/
npm run dev            # nest start --watch
npm run start          # production start

# Next.js Web
cd apps/web
npm run build          # next build
npm run dev            # next dev (port 3000)
npm run lint           # next lint

# Python AI Service
cd apps/ai-service
uvicorn main:app --reload --port 8000
```

---

## Architecture & Module Guide

```
devlon/
├── apps/
│   ├── api/         NestJS REST API (port 3001)
│   ├── web/         Next.js 14 App Router (port 3000)
│   ├── ai-service/  FastAPI ML service (port 8000)
│   └── mobile/      React Native Expo (placeholder)
├── packages/
│   ├── db/          Prisma schema + seed (PostgreSQL)
│   ├── types/       Shared TypeScript types + Zod schemas
│   ├── ui/          Shared shadcn/ui components
│   └── config/      ESLint, tsconfig, Tailwind configs
└── docker/          Docker Compose files
```

### NestJS API Modules

| Module | Path | Status | Description |
|--------|------|--------|-------------|
| auth | `modules/auth` | ✅ Full | JWT login, refresh token rotation, RBAC |
| tenants | `modules/tenants` | ✅ Full | CRUD, branches, config |
| patients | `modules/patients` | ✅ Full | CRUD, MRN gen, tenant-isolated search |
| orders | `modules/orders` | ✅ Full | Create with items, status machine, auto-pricing |
| samples | `modules/samples` | ✅ Full | Barcode accession, chain of custody, rejection |
| results | `modules/results` | 🔧 Stub | Test result entry & auto-verification |
| reports | `modules/reports` | 🔧 Stub | PDF report generation & delivery |
| qc | `modules/qc` | 🔧 Stub | Westgard QC rules, Levey-Jennings |
| instruments | `modules/instruments` | 🔧 Stub | ASTM/HL7 instrument interfacing |
| appointments | `modules/appointments` | 🔧 Stub | Home collection scheduling |
| crm | `modules/crm` | 🔧 Stub | Doctor visits, leads, campaigns |
| billing | `modules/billing` | 🔧 Stub | Invoice, payment, insurance |
| analytics | `modules/analytics` | 🔧 Stub | KPI aggregation |

### Next.js Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `(auth)/login/page.tsx` | JWT login form |
| `/dashboard` | `(dashboard)/page.tsx` | Executive KPI dashboard |
| `/patients` | `(dashboard)/patients/page.tsx` | Patient list with DataTable |
| `/patients/new` | `(dashboard)/patients/new/page.tsx` | New patient registration |
| `/orders/new` | `(dashboard)/orders/new/page.tsx` | 4-step order wizard |
| `/samples` | `(dashboard)/samples/page.tsx` | Sample queue with live refresh |
| `/portal` | `(portal)/layout.tsx` | Patient self-service portal |

---

## API Authentication Flow

```
POST /api/v1/auth/login
Body: { email, password }
Response: { accessToken, refreshToken, expiresIn: 900, user }

# Use access token in all subsequent requests:
Authorization: Bearer <accessToken>

# Refresh when token expires (HTTP 401):
POST /api/v1/auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken, ... }

# Logout (invalidates refresh token):
POST /api/v1/auth/logout   (requires Bearer token)
```

**Demo Credentials** (password: `Admin@123`):

| Role | Email |
|------|-------|
| TENANT_ADMIN | admin@delvion.com |
| SUPER_ADMIN | superadmin@delvion.com |
| LAB_MANAGER | labmanager@delvion.com |
| PATHOLOGIST | pathologist@delvion.com |
| LAB_TECHNICIAN | labtech@delvion.com |
| FRONT_DESK | frontdesk@delvion.com |
| PHLEBOTOMIST | phlebotomist@delvion.com |

---

## Database Operations

```bash
# Create a new migration (after editing schema.prisma)
cd packages/db
npx prisma migrate dev --name "add_column_foo"

# Reset database (⚠️ destroys all data)
npx prisma migrate reset

# Apply migrations to production DB
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio

# Validate schema
npx prisma validate

# Re-seed after reset
npm run db:seed

# Direct psql access (while Docker is running)
docker exec -it delvion-postgres psql -U delvion -d delvion_dev
```

---

## Environment Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (≥32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token secret (≥32 chars) |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token TTL (default: `7d`) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth signing secret |
| `NEXTAUTH_URL` | ✅ | App URL for NextAuth |
| `NEXT_PUBLIC_API_URL` | ✅ | Public API base URL |
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket server URL |
| `MINIO_ENDPOINT` | ✅ | MinIO hostname |
| `MINIO_ACCESS_KEY` | ✅ | MinIO access key |
| `MINIO_SECRET_KEY` | ✅ | MinIO secret key |
| `MINIO_BUCKET` | ✅ | MinIO bucket name |
| `MEILISEARCH_HOST` | ✅ | Meilisearch URL |
| `MEILISEARCH_MASTER_KEY` | ✅ | Meilisearch admin key |
| `OPENAI_API_KEY` | Optional | For AI interpretations |
| `SMTP_HOST` / `SMTP_PORT` | Optional | Email (MailHog in dev) |
| `RAZORPAY_KEY_ID` | Optional | Payment gateway |

---

## Common Issues & Fixes

### "Cannot connect to Docker daemon"

```bash
# Start Docker Desktop app, then:
npm run docker:up
```

### "PrismaClientInitializationError: Can't reach database"

```bash
# Ensure postgres is running
docker ps | grep delvion-postgres

# Check DATABASE_URL in .env.local matches docker-compose:
# postgresql://delvion:delvion123@localhost:5432/delvion_dev
```

### "JWT_SECRET is undefined" at runtime

Check that `.env.local` (or `apps/api/.env`) is present with `JWT_SECRET` set to at least 32 characters.

### "next.config.ts not supported"

The config file must be `next.config.mjs` (not `.ts`). Already fixed — do not rename it back.

### Prisma client out of date

```bash
npm run db:generate
```

### Port already in use (3000 or 3001)

```bash
# Find and kill the process
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### npm install fails with peer dependency errors

```bash
npm install --legacy-peer-deps
```

### "Cannot find module @delvion/types"

```bash
# Ensure workspace packages are symlinked
npm install
# Or regenerate workspace links
npm run clean && npm install --legacy-peer-deps
```

---

## Branding & Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#1B4F8A` | Buttons, links, active states |
| Accent | `#0D7E8A` | Teal highlights, charts |
| Sidebar BG | `#0F1923` | Sidebar background |
| Warning | `#E67E22` | Pending, processing states |
| Error | `#C0392B` | Critical alerts, rejections |
| Success | `#27AE60` | Completed, verified states |
| Font | Inter | All UI text |

**App Name**: `DELViON Health`
**Tagline**: `Global Diagnostic SaaS Platform`
**Demo Tenant Slug**: `delvion-demo`
**Demo Branch**: `Main Branch - Bengaluru`

---

*Generated for DELViON Health v1.0.0 — March 2026*

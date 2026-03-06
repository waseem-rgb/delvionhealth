# DELViON Health — Global Diagnostic SaaS Platform

Production-grade multi-tenant Laboratory Information Management System (LIMS) built on a modern monorepo architecture.

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | NestJS + TypeScript + Prisma ORM |
| Databases | PostgreSQL 15 + MongoDB 7 + Redis 7 |
| File Storage | MinIO |
| Search | Meilisearch |
| Queue | BullMQ + Redis |
| Auth | JWT + RBAC (15 roles) |
| Mobile | React Native (Expo) — patient app |
| AI Service | FastAPI (Python 3.11) |
| Real-time | Socket.io |
| Containers | Docker + Docker Compose |
| Testing | Jest + Playwright |

## Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose
- Git

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd devlon
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your values (defaults work for local Docker setup)
```

### 3. Start Infrastructure (Docker)

```bash
npm run docker:up
# Or: docker compose -f docker/docker-compose.yml up -d

# Services started:
# PostgreSQL    → localhost:5432
# MongoDB       → localhost:27017
# Redis         → localhost:6379
# MinIO         → localhost:9000 (API), localhost:9001 (console)
# Meilisearch   → localhost:7700
# MailHog       → localhost:8025 (UI)
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with demo data
npm run db:seed
```

### 5. Start Development

```bash
npm run dev
# Starts all apps via Turborepo
```

### Access URLs

| Service | URL | Credentials |
|---|---|---|
| Web App | http://localhost:3000 | admin@delvion.com / Admin@123 |
| API Docs | http://localhost:3001/api/docs | — |
| MinIO Console | http://localhost:9001 | delvion_minio / delvion_minio_secret |
| MailHog | http://localhost:8025 | — |
| Prisma Studio | `npm run db:studio` | — |

## Demo Credentials (All use Admin@123)

| Role | Email |
|---|---|
| Super Admin | superadmin@delvion.com |
| Tenant Admin | admin@delvion.com |
| Lab Manager | manager@delvion.com |
| Pathologist | pathologist@delvion.com |
| Lab Technician | technician@delvion.com |
| Front Desk | frontdesk@delvion.com |
| Phlebotomist | phlebotomist@delvion.com |
| Field Sales Rep | sales@delvion.com |
| Finance Executive | finance@delvion.com |
| Patient | patient@delvion.com |

## Project Structure

```
devlon/
├── apps/
│   ├── web/          ← Next.js 14 frontend (port 3000)
│   ├── api/          ← NestJS backend (port 3001)
│   ├── mobile/       ← React Native Expo app
│   └── ai-service/   ← FastAPI ML/AI service (port 8000)
├── packages/
│   ├── ui/           ← Shared shadcn/ui components
│   ├── db/           ← Prisma schema + migrations + seed
│   ├── types/        ← Shared TypeScript types + Zod schemas
│   └── config/       ← Shared ESLint, TypeScript, Tailwind configs
├── docker/           ← Docker Compose configs + nginx
├── infra/            ← Terraform (placeholder)
├── docs/             ← OpenAPI spec
└── .github/          ← GitHub Actions CI/CD
```

## API Modules

| Module | Endpoint | Status |
|---|---|---|
| Auth | /api/v1/auth | ✅ Full |
| Tenants | /api/v1/tenants | ✅ Full |
| Patients | /api/v1/patients | ✅ Full |
| Orders | /api/v1/orders | ✅ Full |
| Samples | /api/v1/samples | ✅ Full |
| Results | /api/v1/results | 🔧 Stub |
| Reports | /api/v1/reports | 🔧 Stub |
| QC | /api/v1/qc | 🔧 Stub |
| Billing | /api/v1/billing | 🔧 Stub |
| CRM | /api/v1/crm | 🔧 Stub |
| Analytics | /api/v1/analytics | 🔧 Stub |
| HR | /api/v1/hr | 🔧 Stub |
| Inventory | /api/v1/inventory | 🔧 Stub |

## Scripts

```bash
npm run dev          # Start all apps
npm run build        # Build all apps
npm run lint         # Lint all packages
npm run test         # Run all tests
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
```

## RBAC Roles

The platform supports 15 roles with fine-grained access control:

`SUPER_ADMIN` | `TENANT_ADMIN` | `LAB_MANAGER` | `PATHOLOGIST` | `LAB_TECHNICIAN` | `FRONT_DESK` | `PHLEBOTOMIST` | `FIELD_SALES_REP` | `FINANCE_EXECUTIVE` | `HR_MANAGER` | `PROCUREMENT_MANAGER` | `DOCTOR` | `PATIENT` | `CORPORATE_CLIENT` | `IT_ADMIN`

## License

Proprietary — DELViON Health © 2024

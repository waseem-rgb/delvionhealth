# DELViON Health — Complete Architecture Reference

> **Last audited**: 2026-03-05
> **Status**: Production-grade, all builds verified (0 TS errors API + Web)
> **Purpose**: Safe architecture prompt for additive-only product development

---

## 1. SYSTEM OVERVIEW

| Layer | Tech | Path | Port |
|-------|------|------|------|
| **Frontend** | Next.js 14.2.29 App Router | `apps/web/` | 3000 |
| **Backend API** | NestJS 10 | `apps/api/` | 3001 |
| **AI Service** | FastAPI (Python) | `apps/ai-service/` | 8000 |
| **Mobile** | React Native Expo 52 | `apps/mobile/` | — |
| **Database** | PostgreSQL 15 | via Docker | 5432 |
| **Cache** | Redis 7 | via Docker | 6379 |
| **Search** | Meilisearch | via Docker | 7700 |
| **Storage** | MinIO (S3-compat) | via Docker | 9000/9001 |
| **Email (dev)** | MailHog | via Docker | 1025/8025 |
| **Shared Types** | `@delvion/types` | `packages/types/` | — |
| **Shared DB** | `@delvion/db` (Prisma) | `packages/db/` | — |

**Monorepo**: Turborepo + npm workspaces
**API prefix**: `/api/v1` (set in `main.ts`)
**Auth**: JWT (15min access + 7d refresh in Redis)
**Multi-tenancy**: Row-level via `tenantId` on every model
**Roles**: 15 (SUPER_ADMIN, TENANT_ADMIN, LAB_MANAGER, PATHOLOGIST, LAB_TECHNICIAN, FRONT_DESK, PHLEBOTOMIST, FIELD_SALES_REP, FINANCE_EXECUTIVE, HR_MANAGER, PROCUREMENT_MANAGER, IT_ADMIN, DOCTOR, PATIENT, CORPORATE_CLIENT)

---

## 2. DATABASE — 110+ MODELS, 47 ENUMS

### Schema: `packages/db/prisma/schema.prisma` (2,815 lines)

#### Core Infrastructure
| Model | Purpose |
|-------|---------|
| Tenant | Multi-tenant base: slug, plan, status, branding, config |
| TenantBranch | Physical lab branches per tenant |
| User | Auth subject: email, passwordHash, role, tenantId |
| PushToken | Mobile push tokens (Expo) |

#### Patient & Order Lifecycle
| Model | Purpose |
|-------|---------|
| Patient | MRN `DH-YYYY-XXXXXX`, demographics, insurance, portal link |
| Order | `DH-ORD-YYYYMMDD-XXXX`, 16-status state machine, priority, collectionType |
| OrderItem | Line items linking Order ↔ TestCatalog |
| TestCatalog | Master test list: code, name, price, TAT, LOINC/SNOMED, type (TEST/PROFILE) |
| TestPackage | Profile/panel bundles: component test IDs in `items` JSON, discount, linked to TestCatalog via `testCatalogId` |
| ReferenceRange | Age/gender-specific normal ranges per test |
| StandingOrder | Recurring orders (daily/weekly/monthly) |
| PatientHealthProfile | AI-derived health score + risk flags |

#### Sample Management
| Model | Purpose |
|-------|---------|
| Sample | Barcode `DH-S-YYYYMMDD-XXXX`, 8-status lifecycle, vacutainer/volume tracking |
| SampleMovement | Chain of custody audit trail |
| SpecimenRejection | 10 rejection reasons (HEMOLYZED, INSUFFICIENT_QUANTITY, etc.) |

#### Results & Reports
| Model | Purpose |
|-------|---------|
| TestResult | Value, interpretation (NORMAL/ABNORMAL/CRITICAL), delta flagging (25%), auto-verify |
| LabReport | `DH-RPT-...`, status (DRAFT→GENERATED→SIGNED→DELIVERED), PDF in MinIO, approval workflow |
| ReportTemplate | Customizable layout: logo, colors, fonts, visibility toggles |
| ReportDispatch | Multi-channel delivery (EMAIL/SMS/WHATSAPP) with status tracking |
| CriticalValueAck | Critical result acknowledgment audit |

#### Billing & Revenue Cycle
| Model | Purpose |
|-------|---------|
| Invoice | `DH-INV-YYYYMMDD-XXXX`, multi-payment, PDF generation |
| InvoiceItem | Line items per invoice |
| Payment | 7 methods (CASH/CARD/UPI/WALLET/INSURANCE/BANK_TRANSFER/CREDIT) |
| InsuranceClaim | Full lifecycle: DRAFT→SUBMITTED→APPROVED/REJECTED→APPEALED→SETTLED |
| PatientPaymentPlan | EMI/installment plans |
| DoctorCommission | Referral commission (FLAT/PERCENTAGE/TIERED) |
| B2BInvoice / B2BInvoiceLineItem / B2BPayment | Consolidated corporate billing |

#### CRM
| Model | Purpose |
|-------|---------|
| Doctor | CRM profile, engagement scoring, signature, login, AI tier |
| DoctorVisit | Field visits with GPS |
| Lead | B2B pipeline: 6 statuses, AI scoring (HOT/WARM/COLD) |
| LeadNote | Activity log (CALL/EMAIL/MEETING/NOTE) |
| Campaign | Marketing campaign tracking |

#### QC & Instruments
| Model | Purpose |
|-------|---------|
| Instrument | Registry: status (ACTIVE/INACTIVE/MAINTENANCE/CALIBRATION) |
| QCRun / QCEntry | Daily QC data, Westgard rules, Levey-Jennings |
| CAPA | Corrective/Preventive Actions |
| InstrumentConnection | ASTM/HL7 gateway (net.createServer per connection) |
| InstrumentMessage | Message log with auto-result posting |
| TemperatureLogger / TemperatureReading | Cold chain IoT monitoring |

#### Organizations & Outsourcing
| Model | Purpose |
|-------|---------|
| Organization | B2B clients: credit management, nested hierarchy, custom branding |
| Referencelab / ReflabTest | Reference lab network |
| OutsourcedSample / OutsourcedTest | Outsourced sample tracking |

#### Finance & Accounting
| Model | Purpose |
|-------|---------|
| GLAccount | Chart of accounts (hierarchical) |
| JournalEntry / JournalLine | Double-entry accrual accounting |
| BankAccount / BankStatement | Bank reconciliation |

#### HR & Staffing
| Model | Purpose |
|-------|---------|
| Employee | HR master linked to User |
| Attendance | Daily check-in/out tracking |
| Leave / LeaveRequest / LeaveType | Leave management workflow |
| Shift / ShiftAssignment | Shift scheduling |
| PayrollRun / PayrollEntry | Monthly payroll processing |

#### Inventory & Procurement
| Model | Purpose |
|-------|---------|
| Vendor | Supplier master |
| PurchaseOrder | Procurement (6 statuses) |
| InventoryItem / InventoryLot / StockMovement | Stock tracking with FIFO |
| GoodsReceivedNote / GRNItem | GRN receipt |

#### Rate Lists & Pricing
| Model | Purpose |
|-------|---------|
| RateList / RateListItem | Price list variants per org/date range |
| RatePriceAuditLog | Price change audit trail |

#### Super Admin & SaaS
| Model | Purpose |
|-------|---------|
| SubscriptionPlan | SaaS pricing tiers |
| TenantSubscription | Active subscriptions per tenant |
| PlatformInvoice / UsageRecord | SaaS billing + usage metering |
| FeatureFlag / FeatureFlagOverride | Per-tenant feature toggles |

#### Audit & Notifications
| Model | Purpose |
|-------|---------|
| AuditLog | Immutable compliance trail (JSON diffs) |
| Notification / NotificationPreference | Multi-channel notifications |
| ApiKey / WebhookConfig | Integration auth + webhooks |

---

## 3. BACKEND API — 200+ ENDPOINTS ACROSS 36 MODULES

### Module Registry (`app.module.ts`)

| # | Module | Controller(s) | Key Endpoints |
|---|--------|--------------|---------------|
| 1 | **AuthModule** | auth | POST login/refresh/logout, change-password, forgot/reset-password |
| 2 | **TenantsModule** | tenants | CRUD tenants, branches, report-settings, upload-report-image |
| 3 | **UsersModule** | users | List, invite, update role/status |
| 4 | **PatientsModule** | patients | CRUD, search, MRN preview, duplicates, merge, timeline, stats |
| 5 | **OrdersModule** | orders, test-catalog, trf | CRUD orders, status transitions, add/remove items, discount; test catalog CRUD + profiles + bulk upload + AI suggest + PDF parse |
| 6 | **SamplesModule** | samples | Accession, status updates, queue, counts, custody, barcode lookup |
| 7 | **ResultsModule** | results | Enter/bulk-enter, verify, validate, pending worklist, patient history |
| 8 | **ReportsModule** | reports | Generate PDF (Puppeteer→MinIO), sign, deliver, download |
| 9 | **BillingModule** | billing, patient-billing, organization, b2b-invoice, discount | Invoices, payments, refunds, claims, denial management, payment plans, receivables |
| 10 | **QcModule** | qc | QC runs, Levey-Jennings, CAPA, TAT report, critical values |
| 11 | **CrmModule** | crm (doctors, leads, campaigns, commissions, targets, territory) | Doctor CRM, lead Kanban, campaigns, commissions, territory heatmap |
| 12 | **AnalyticsModule** | analytics | Dashboard KPIs, full-report (20 parallel queries) |
| 13 | **InstrumentsModule** | instruments, temperature | Instrument registry, ASTM/HL7 connections/messages, cold chain |
| 14 | **AppointmentsModule** | appointments | List, update status, send reminder |
| 15 | **NotificationsModule** | notifications | List, mark-read, preferences, push tokens |
| 16 | **FhirModule** | fhir | FHIR R4: Patient, DiagnosticReport, Observation, ServiceRequest, CapabilityStatement |
| 17 | **PortalModule** | portal | Patient portal: bookings, reports, track, profile, health-insights, family |
| 18 | **IntegrationsModule** | integrations | List integrations, API key CRUD |
| 19 | **SearchModule** | search | Unified search (patients/tests/invoices), reindex |
| 20 | **AiModule** (@Global) | ai | GET status, POST analytics insights, POST report interpretation |
| 21 | **SuperAdminModule** | super-admin | Platform stats, MRR, health, tenant provisioning, feature flags, audit log |
| 22 | **LabModule** | lab/accession, lab/results | Accession stats/receive/reject/bulk-receive, result entry draft/submit/validate |
| 23 | **RateListsModule** | rate-lists | CRUD rate lists, items bulk update, audit log, Excel upload/download |
| 24 | **OrganisationsModule** | organisations | CRUD orgs, generate login, ledger, payments, rates, header/footer upload |
| 25 | **DoctorsModule** | doctors | CRUD doctors, signing doctors, signature upload, passkey, login |
| 26 | **FinanceModule** | finance | GL accounts, journal entries, trial balance, P&L, balance sheet, cash flow, bank reconciliation |

### Global Infrastructure
- **Guards**: JwtAuthGuard, RolesGuard, TenantGuard
- **Decorators**: @Public, @Roles, @CurrentUser, @TenantId
- **Interceptors**: TransformInterceptor (response wrapper), AuditLogInterceptor
- **Filters**: GlobalExceptionFilter
- **Pipes**: ValidationPipe (whitelist + transform), ZodValidationPipe
- **Middleware**: TenantMiddleware (excludes auth + health routes)
- **Rate Limiting**: 20 req/s (short), 200 req/min (long)
- **Swagger**: `/api/docs` (non-production)

---

## 4. FRONTEND — 78 PAGES

### Sidebar Navigation (5 Groups, Role-Filtered)

**Overview**: Dashboard, Analytics
**Front Desk**: Registration & Billing, Patients, Appointments, Orders
**Lab Operations**: Accession, Samples, Results, QC, Instruments, Approvals, Operations, Outsourcing
**Reports & Billing**: Reports, MIS Reports, Invoices & Payments, Organisations, Insurance, Clinics, Leads
**Settings**: Settings, Doctors, Report Settings, Rate Lists, Report Templates, Integrations, API Keys, FHIR Explorer, Audit Logs

### Key Pages & What They Do

| Route | Features |
|-------|----------|
| `/dashboard` | 6 KPIs, Lab Pipeline flow, Revenue Trend, Orders by Status, Hourly Registrations, Recent Orders, Critical Alerts |
| `/analytics` | Date range presets, 20-query full report, KPI cards, revenue/category/status charts, demographics, TAT analysis |
| `/patients` | DataTable, search (name/phone/MRN), gender filter, status tabs (All/Duplicates/Inactive), keyboard shortcut N |
| `/patients/[id]` | 5 tabs (Overview, Orders, Reports, Timeline, Documents), stats cards |
| `/orders` | Status tabs, priority chips, collection source filter (Walk-in/Home/B2B), date range |
| `/orders/new` | 4-step wizard: patient → test browser (AI suggestions) → pricing → payment |
| `/samples` | Kanban (@dnd-kit) + table toggle, barcode scanner, count chips, TAT prediction |
| `/results` | Split-pane workbench, grouped worklist, inline interpretation + delta, critical alerts via WebSocket |
| `/reports` | Status tabs, PDF preview, Sign modal, Deliver modal, AI interpretation (Sparkles) |
| `/billing` | 4 tabs: Invoices, Payments (charts), Insurance Claims, AR Aging |
| `/crm/doctors` | Engagement scores, AI tier badges, territory map (Leaflet), log visit modal |
| `/crm/leads` | Kanban (4 columns + WON/LOST), AI grade badges, drag-to-move, notes |
| `/settings` | 7 tabs: Team, Test Catalog (+ Create Profile), Notifications, Integrations, Branch, Billing, Smart Features |
| `/settings/rate-lists` | Rate list CRUD, Excel upload/download, price audit log |
| `/integrations/fhir` | 3-tab FHIR R4 JSON viewer |
| `/portal/*` | Patient portal: home, book appointment, view reports, track samples, profile, health insights, family |
| `/super-admin` | Platform stats, tenant management, feature flags, MRR trend, audit log |

### Shared Components (`apps/web/src/components/shared/`)
KPICard, DataTable, SearchInput, StatusBadge, PriorityBadge, DateRangePicker, InfiniteCombobox, ConfirmDialog, LoadingSpinner, PageHeader, EmptyState, BarcodeDisplay, TagInput

### Custom Hooks (`apps/web/src/hooks/`)
- `useAuth(requiredRoles?)` — Auth check + role enforcement
- `useCriticalAlerts(handler)` — WebSocket critical result alerts
- `useOrderUpdates(handler)` — WebSocket order status changes
- `useSampleUpdates(handler)` — WebSocket sample status changes
- `useNotifications(handler)` — WebSocket in-app notifications

### State Management
- **Auth**: Zustand `useAuthStore` (login/logout/hydrate)
- **Tenant**: Zustand `useTenantStore` (activeBranch)
- **Server state**: TanStack React Query (60s stale time, 1 retry)
- **API client**: Axios with interceptors (auto-attach JWT, 401 refresh, redirect)

---

## 5. AI SERVICE — 4 ML MODELS

| Model | Endpoint | Algorithm | Integration Point |
|-------|----------|-----------|-------------------|
| SymptomTestMapper | POST /suggest | TF-IDF | Order wizard test suggestions |
| LeadScorer | POST /leads/score | Rule-based | CRM lead Kanban AI grades |
| TATPredictor | POST /tat/predict | Priority+time factors | Sample queue TAT predictions |
| DoctorInfluencer | POST /doctors/score | 5-factor scoring | CRM doctor AI tier badges |

**NestJS Integration**: `AiModule` (@Global) wraps all endpoints with 3-5s timeout + graceful fallback
**Provider-agnostic AI** (for analytics/report interpretation): Anthropic primary → OpenAI fallback
**Frontend branding**: "DELViON Smart Insights" (no provider names shown)

---

## 6. MOBILE APP — 4 ROLE-BASED PORTALS

| Portal | Route Group | Features |
|--------|-------------|----------|
| Patient | `/(patient)/` | Book appointments, view reports, track samples |
| Phlebotomist | `/(phlebotomist)/` | Sample collection, barcode scanning |
| Doctor | `/(doctor)/` | View referrals, sign reports |
| Staff | `/(app)/` | Shared dashboard |

Tech: Expo ~52, expo-router ~4, React 18.3.1, Zustand, push notifications via Expo

---

## 7. ORDER-TO-REPORT WORKFLOW (End-to-End)

```
REGISTRATION
  Patient lookup/create → MRN auto-generated (DH-YYYY-XXXXXX)
  ↓
ORDER CREATION
  Select tests (from catalog/rate list) → Apply pricing/discount → Collect payment
  Order# DH-ORD-YYYYMMDD-XXXX created → Invoice auto-generated → Sample auto-created
  ↓
ACCESSION
  Sample barcode: DH-S-YYYYMMDD-XXXX → Status: PENDING_COLLECTION
  ↓
SAMPLE PIPELINE
  PENDING_COLLECTION → COLLECTED → IN_TRANSIT → RECEIVED → PROCESSING → STORED
  (Chain of custody logged at each step)
  ↓
RESULT ENTRY
  Lab tech enters values → Auto-interpretation (NORMAL/ABNORMAL/CRITICAL)
  Delta check (25% threshold vs previous) → Verify → Pathologist validate
  ↓
REPORT GENERATION
  Puppeteer renders HTML→PDF → Stored in MinIO → Branding from tenant/org settings
  ↓
APPROVAL & SIGNING
  Pathologist signs (regenerates PDF with signature)
  ↓
DELIVERY
  Mark delivered → Email patient → Order status → REPORTED
  Multi-channel dispatch: EMAIL / SMS / WhatsApp
```

**Order Status State Machine** (16 states):
```
DRAFT → PENDING → CONFIRMED → PENDING_COLLECTION → SAMPLE_COLLECTED → RECEIVED
  → SAMPLE_REJECTED (terminal)
  → PENDING_PROCESSING → IN_PROCESSING → PENDING_APPROVAL → RESULTED → APPROVED
  → REPORTED → DISPATCHED → DELIVERED → ARCHIVED
  → CANCELLED (from any non-terminal state)
```

---

## 8. INFRASTRUCTURE & DOCKER

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:15-alpine | 5432 | Primary DB (delvion_dev) |
| redis | redis:7-alpine | 6379 | Cache, sessions, refresh tokens |
| minio | minio/minio | 9000/9001 | PDFs (reports, invoices), uploads |
| meilisearch | getmeili/meilisearch | 7700 | Full-text search |
| mailhog | mailhog/mailhog | 1025/8025 | Dev email testing |
| mongo | mongo:7 | 27017 | Audit logs (secondary) |

**Credentials** (dev): user=delvion, pass=delvion123, MinIO=delvion_minio/delvion_minio_secret

---

## 9. CRITICAL BUILD RULES

| Rule | Detail |
|------|--------|
| API dist path | `dist/apps/api/src/main` (no rootDir in tsconfig) |
| API start | `node dist/apps/api/src/main` |
| Next.js config | `next.config.mjs` (NOT .ts — unsupported in 14.x) |
| CSS fix | Use `border-color: hsl(var(--border))` NOT `@apply border-border` |
| Web tsconfig | `exactOptionalPropertyTypes: false`, `noUnusedLocals: false` |
| Prisma client | At monorepo root `node_modules/.prisma/client/` |
| Prisma generate | `cd packages/db && npx prisma generate` |
| Type checking | `cd apps/api && npx tsc --noEmit` and `cd apps/web && npx tsc --noEmit` |

---

## 10. DEMO ACCOUNTS

| Role | Email | Password |
|------|-------|----------|
| Tenant Admin | admin@delvion.com | Admin@123 |
| Super Admin | superadmin@delvion.com | Admin@123 |
| Lab Manager | labmanager@delvion.com | Admin@123 |
| Pathologist | pathologist@delvion.com | Admin@123 |

Tenant: delvion-demo | Branch: Main Branch - Bengaluru

---

## 11. WHAT IS FULLY WORKING (VERIFIED)

### Completed Phases
- **Phase 1**: Auth (JWT, refresh tokens, password reset, Redis sessions)
- **Phase 2**: Layout, Navigation, Executive Dashboard, Realtime (Socket.io)
- **Phase 3**: Patients (CRUD, MRN, search, timeline, stats, merge, duplicates)
- **Phase 4**: Orders (4-step wizard, state machine, test catalog, AI suggestions)
- **Phase 5**: Samples (accession, barcode, Kanban, chain of custody, scanner)
- **Phase 6**: Results (split-pane workbench, interpretation, delta, verify/validate)
- **Phase 7**: Reports (Puppeteer PDF, sign, deliver, branding, MinIO storage)
- **Phase 8**: Billing (invoices, payments, refunds, insurance claims, AR aging)
- **Phase 9**: CRM (doctors + engagement scoring, leads Kanban, AI grades)
- **Phase 10**: Patient Portal (home, booking, reports, tracking, profile)
- **Phase 11**: Settings (team, test catalog, notifications, integrations, branch)
- **Phase 12**: Analytics (20-query report, charts, demographics, TAT)
- **Phase A**: AI Service (4 ML models + NestJS wrapper + frontend integration)
- **Phase B**: Instruments (ASTM/HL7 gateway), FHIR R4, LOINC mapping, IoT temp, multi-channel comms
- **Phase C0-C5**: Mobile app (patient/phlebotomist/doctor portals, push notifications)
- **Phase D**: Super Admin (tenant provisioning, feature flags, usage metering, MRR)
- **Phase E1-E6**: Report templates, dispatch, approval workflow, MIS, B2B invoicing
- **Phase F1-F3**: Outsourcing (reference labs, dispatching, result intake)
- **Phase G1-G3**: Organisations, rate lists, discount approvals
- **AI Enhancement**: Provider-agnostic AI (Anthropic/OpenAI), smart analytics, report interpretation
- **Test Profiles**: Create/manage test profiles/panels with component tests and discounts

### End-to-End Verified Workflows
1. Patient registration → Order creation (walk-in, rate list pricing) → Sample accession → Sample pipeline → Result entry → Verify → Validate → Report generation (branded PDF) → Sign → Deliver
2. AI test suggestions in order wizard
3. CRM doctor scoring + lead pipeline
4. Billing invoice generation + payment recording

---

## 12. SAFE DEVELOPMENT RULES

### Additive-Only Approach
1. **NEVER** remove or rename existing API endpoints — add new ones alongside
2. **NEVER** change existing Prisma model field types — add new fields instead
3. **NEVER** remove enum values — only add new ones
4. **NEVER** change the order of NestJS controller route decorators (especially `:id` catch-all routes must stay LAST)
5. **ALWAYS** run `npx tsc --noEmit` on both apps/api and apps/web after changes
6. **ALWAYS** use `$transaction` for multi-model writes
7. **ALWAYS** include `tenantId` in every query WHERE clause
8. **ALWAYS** use role-based guards on new endpoints
9. **ALWAYS** keep profile routes BEFORE `:id` routes in controllers
10. **PREFER** `db push` over `migrate dev` in non-interactive environments

### Code Patterns to Follow
- **API responses**: Wrapped by `TransformInterceptor` → `{ success, data, timestamp }`
- **Frontend API calls**: `api.get/post()` → access `res.data.data` for actual payload
- **New pages**: Create at `apps/web/src/app/(dashboard)/{route}/page.tsx`
- **New modules**: Register in `app.module.ts` imports array
- **Shared types**: Define in `packages/types/src/`, export from `index.ts`
- **New enums**: Add to both `packages/types/src/enums.ts` AND Prisma schema

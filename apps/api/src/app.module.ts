import { Module, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./modules/redis/redis.module";
import { EmailModule } from "./modules/email/email.module";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { SamplesModule } from "./modules/samples/samples.module";
import { ResultsModule } from "./modules/results/results.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { QcModule } from "./modules/qc/qc.module";
import { InstrumentsModule } from "./modules/instruments/instruments.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { CrmModule } from "./modules/crm/crm.module";
import { BillingModule } from "./modules/billing/billing.module";
import { InsuranceModule } from "./modules/insurance/insurance.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { HrModule } from "./modules/hr/hr.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { AiModule } from "./modules/ai/ai.module";
import { ProcurementModule } from "./modules/procurement/procurement.module";
import { SearchModule } from "./modules/search/search.module";
import { PortalModule } from "./modules/portal/portal.module";
import { FhirModule } from "./modules/fhir/fhir.module";
import { StandardsModule } from "./modules/standards/standards.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { AuditModule } from "./common/services/audit.module";
import { OutsourcingModule } from "./modules/outsourcing/outsourcing.module";
import { LabModule } from "./modules/lab/lab.module";
import { RateListsModule } from "./modules/rate-lists/rate-lists.module";
import { OrganisationsModule } from "./modules/organisations/organisations.module";
import { DoctorsModule } from "./modules/doctors/doctors.module";
import { ReportBuilderModule } from "./modules/report-builder/report-builder.module";
import { BulkRegistrationModule } from "./modules/bulk-registration/bulk-registration.module";
import { TestNotesModule } from "./modules/test-notes/test-notes.module";
import { SmartReportModule } from "./modules/smart-report/smart-report.module";
import { VoiceAgentModule } from "./modules/voice-agent/voice-agent.module";
import { WellnessModule } from "./modules/wellness/wellness.module";
import { QualityModule } from "./modules/quality/quality.module";
import { MarketingModule } from "./modules/marketing/marketing.module";
import { FrontDeskModule } from "./modules/front-desk/front-desk.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { RevenueCrmModule } from "./modules/revenue-crm/revenue-crm.module";
import { LabPackagesModule } from "./modules/lab-packages/lab-packages.module";
import { SopsModule } from "./modules/sops/sops.module";
import { QualityFormsModule } from "./modules/quality-forms/quality-forms.module";
import { NonPathModule } from "./modules/non-path/non-path.module";
import { TenantMiddleware } from "./common/middleware/tenant.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 200,
      },
    ]),
    PrismaModule,
    AuditModule,
    RedisModule,
    EmailModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    PatientsModule,
    OrdersModule,
    SamplesModule,
    ResultsModule,
    ReportsModule,
    QcModule,
    InstrumentsModule,
    AppointmentsModule,
    CrmModule,
    BillingModule,
    InsuranceModule,
    FinanceModule,
    HrModule,
    InventoryModule,
    NotificationsModule,
    AnalyticsModule,
    IntegrationsModule,
    RealtimeModule,
    AiModule,
    ProcurementModule,
    SearchModule,
    PortalModule,
    FhirModule,
    StandardsModule,
    SuperAdminModule,
    OutsourcingModule,
    LabModule,
    RateListsModule,
    OrganisationsModule,
    DoctorsModule,
    ReportBuilderModule,
    BulkRegistrationModule,
    TestNotesModule,
    SmartReportModule,
    VoiceAgentModule,
    WellnessModule,
    QualityModule,
    MarketingModule,
    FrontDeskModule,
    CouponsModule,
    RevenueCrmModule,
    LabPackagesModule,
    SopsModule,
    QualityFormsModule,
    NonPathModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: "api/v1/auth/login", method: RequestMethod.POST },
        { path: "api/v1/auth/refresh", method: RequestMethod.POST },
        { path: "api/v1/auth/forgot-password", method: RequestMethod.POST },
        { path: "api/v1/auth/reset-password", method: RequestMethod.POST },
        { path: "api/v1/health", method: RequestMethod.GET },
        { path: "api/v1/voice-agent/config/(.*)", method: RequestMethod.GET },
        { path: "api/v1/voice-agent/session", method: RequestMethod.POST },
        { path: "api/v1/voice-agent/chat", method: RequestMethod.POST },
        { path: "api/v1/voice-agent/session/(.*)", method: RequestMethod.GET },
        { path: "api/v1/voice-agent/embed.js", method: RequestMethod.GET },
        { path: "api/v1/wellness/share/(.*)", method: RequestMethod.GET }
      )
      .forRoutes("*");
  }
}

import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { PatientBillingService } from "./patient-billing.service";
import { PatientBillingController } from "./patient-billing.controller";
import { B2BInvoiceService } from "./b2b-invoice.service";
import { B2BInvoiceController } from "./b2b-invoice.controller";
import { OrganizationService } from "./organization.service";
import { OrganizationController } from "./organization.controller";
import { DiscountService } from "./discount.service";
import { DiscountController } from "./discount.controller";
import { MinioService } from "../reports/minio.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { RateListsModule } from "../rate-lists/rate-lists.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [NotificationsModule, RateListsModule, RealtimeModule],
  providers: [
    BillingService,
    PatientBillingService,
    B2BInvoiceService,
    OrganizationService,
    DiscountService,
    MinioService,
  ],
  controllers: [
    BillingController,
    PatientBillingController,
    B2BInvoiceController,
    OrganizationController,
    DiscountController,
  ],
  exports: [BillingService, PatientBillingService, B2BInvoiceService, OrganizationService, DiscountService],
})
export class BillingModule {}

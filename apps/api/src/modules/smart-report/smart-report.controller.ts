import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { SmartReportService } from "./smart-report.service";

@Controller("smart-report")
@UseGuards(JwtAuthGuard, TenantGuard)
export class SmartReportController {
  constructor(private readonly svc: SmartReportService) {}

  @Get("settings")
  getSettings(@TenantId() tenantId: string) {
    return this.svc.getSettings(tenantId);
  }

  @Put("settings")
  updateSettings(
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateSettings(tenantId, body);
  }

  @Post("build-index")
  buildIndex() {
    return this.svc.buildIndex();
  }

  @Get("index-status")
  getIndexStatus() {
    return {
      indexed: this.svc.isIndexed,
      chunkCount: this.svc.chunkCount,
    };
  }

  @Post("generate")
  generateSmartReport(
    @TenantId() tenantId: string,
    @Body()
    body: {
      abnormalParams: Array<{
        name: string;
        value: string;
        unit: string;
        referenceRange: string;
        flag: string;
        testName: string;
      }>;
      patientAge: number;
      patientGender: string;
    },
  ) {
    return this.svc.generateSmartReport(
      body.abnormalParams,
      body.patientAge,
      body.patientGender,
      tenantId,
    );
  }
}

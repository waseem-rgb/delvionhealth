import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { BulkRegistrationService } from "./bulk-registration.service";

@Controller("bulk-registration")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BulkRegistrationController {
  constructor(private readonly svc: BulkRegistrationService) {}

  @Get("template")
  getTemplate() {
    return this.svc.getTemplateColumns();
  }

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
  ) {
    if (!file) throw new Error("No file uploaded");
    const rows = this.svc.parseExcel(file.buffer);
    return this.svc.normaliseRows(
      rows,
      tenantId,
      file.originalname,
      user.id,
    );
  }

  @Get("job/:jobId")
  getPreview(
    @Param("jobId") jobId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.getJobPreview(jobId, tenantId);
  }

  @Patch("row/:rowId")
  updateRow(
    @Param("rowId") rowId: string,
    @Body() body: { normalisedData: Record<string, unknown> },
  ) {
    return this.svc.updateRow(rowId, body.normalisedData);
  }

  @Post("job/:jobId/register")
  registerAll(
    @Param("jobId") jobId: string,
    @Body() body: { skipUnmatched?: boolean; branchId: string; organisationId?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.registerAll(
      jobId,
      tenantId,
      user.id,
      body.branchId,
      body.skipUnmatched ?? true,
      body.organisationId,
    );
  }
}

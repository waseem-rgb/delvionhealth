import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { TestNotesService } from "./test-notes.service";

@Controller("test-notes")
@UseGuards(JwtAuthGuard, TenantGuard)
export class TestNotesController {
  constructor(private readonly svc: TestNotesService) {}

  @Get("progress")
  getProgress(@TenantId() tenantId: string) {
    return this.svc.getProgress(tenantId);
  }

  @Get(":testCatalogId")
  getNotes(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.getNotes(testCatalogId, tenantId);
  }

  @Post(":testCatalogId/generate")
  generateNotes(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.generateForTest(testCatalogId, tenantId);
  }

  @Post("generate-all")
  generateAll(@TenantId() tenantId: string) {
    return this.svc.generateAllNotes(tenantId);
  }

  @Put(":testCatalogId")
  updateNotes(
    @Param("testCatalogId") testCatalogId: string,
    @TenantId() tenantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updateNotes(testCatalogId, tenantId, body);
  }
}

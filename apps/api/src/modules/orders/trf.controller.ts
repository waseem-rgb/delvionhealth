import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { TrfService } from "./trf.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import type { Response } from "express";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TrfController {
  constructor(private readonly trfService: TrfService) {}

  @Get(":id/trf")
  @ApiOperation({ summary: "Generate and download Test Requisition Form (TRF) as PDF" })
  @ApiProduces("application/pdf")
  async generateTrf(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.trfService.generateTRF(id, user.tenantId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="TRF-${id}.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });

    res.send(pdfBuffer);
  }
}

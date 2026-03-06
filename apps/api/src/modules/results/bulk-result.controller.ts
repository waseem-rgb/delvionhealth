import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { BulkResultService } from "./bulk-result.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

/** Minimal Multer file shape — avoids requiring @types/multer */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags("results")
@ApiBearerAuth()
@Controller("results")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BulkResultController {
  constructor(private readonly bulkService: BulkResultService) {}

  @Get("bulk-template")
  @ApiOperation({ summary: "Download Excel template for bulk result entry" })
  @ApiQuery({
    name: "orderIds",
    required: true,
    description: "Comma-separated order IDs",
  })
  async downloadTemplate(
    @CurrentUser() user: JwtPayload,
    @Query("orderIds") orderIds: string,
    @Res() res: Response,
  ) {
    if (!orderIds) {
      throw new BadRequestException("orderIds query parameter is required");
    }

    const ids = orderIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      throw new BadRequestException("At least one order ID is required");
    }

    const buffer = await this.bulkService.generateTemplate(user.tenantId, ids);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulk-results-template-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  }

  @Post("bulk-upload")
  @ApiOperation({ summary: "Upload filled Excel file with bulk results" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadResults(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded. Use multipart field name 'file'.");
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (file.mimetype && !validTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.",
      );
    }

    return this.bulkService.parseAndSave(user.tenantId, file.buffer, user.sub);
  }
}

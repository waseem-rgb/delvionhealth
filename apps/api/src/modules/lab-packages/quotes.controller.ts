import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { QuotesService } from "./quotes.service";
import { AiPackageService } from "./ai-package.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";

@ApiTags("quotes")
@ApiBearerAuth()
@Controller("quotes")
@UseGuards(JwtAuthGuard, TenantGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly aiPackageService: AiPackageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List quotes" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("date") date?: string,
  ) {
    return this.quotesService.findAll(user.tenantId, { status, date });
  }

  @Post()
  @ApiOperation({ summary: "Create quote" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, any>,
  ) {
    return this.quotesService.create(user.tenantId, dto, user.sub);
  }

  @Post("ai-chat")
  @ApiOperation({ summary: "Quote builder AI chat" })
  aiChat(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      sessionId?: string;
      message: string;
      context?: {
        patientAge?: number;
        patientGender?: string;
        symptoms?: string;
        budget?: number;
      };
    },
  ) {
    return this.aiPackageService.chat(
      user.tenantId,
      body.sessionId ?? null,
      body.message,
      "QUOTE_BUILDER",
      body.context ?? {},
      user.sub,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get quote" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.quotesService.findOne(user.tenantId, id);
  }

  @Patch(":id/send")
  @ApiOperation({ summary: "Mark quote as sent" })
  markSent(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.quotesService.markSent(user.tenantId, id);
  }

  @Patch(":id/convert")
  @ApiOperation({ summary: "Convert quote to order" })
  convert(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.quotesService.convert(user.tenantId, id);
  }

  @Post(":id/save-as-package")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Save quote as permanent package" })
  saveAsPackage(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { name: string },
  ) {
    return this.quotesService.saveAsPackage(
      user.tenantId,
      id,
      body.name,
      user.sub,
    );
  }
}

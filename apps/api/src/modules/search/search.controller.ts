import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("search")
@ApiBearerAuth()
@Controller("search")
@UseGuards(JwtAuthGuard, TenantGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: "Unified search (patients, tests, invoices)" })
  @ApiQuery({ name: "q", required: true })
  @ApiQuery({ name: "type", required: false, enum: ["patients", "tests", "invoices"] })
  search(@CurrentUser() user: JwtPayload, @Query("q") q: string, @Query("type") type?: string) {
    return this.searchService.unifiedSearch(q ?? "", user.tenantId, type);
  }

  @Post("reindex")
  @ApiOperation({ summary: "Reindex all data for tenant" })
  reindexAll(@CurrentUser() user: JwtPayload) {
    return this.searchService.reindexAll(user.tenantId);
  }
}

import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, Res } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { TestCatalogService } from "./test-catalog.service";
import { PdfParserService } from "./pdf-parser.service";
import { AiService } from "../ai/ai.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";
import { PrismaService } from "../../prisma/prisma.service";
import { seedTestTemplates } from "./seed-test-templates";

const UPLOAD_DIR = path.join(os.tmpdir(), "delvion-uploads");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { /* ignore */ }

@ApiTags("test-catalog")
@ApiBearerAuth()
@Controller("test-catalog")
@UseGuards(JwtAuthGuard, TenantGuard)
export class TestCatalogController {
  constructor(
    private readonly testCatalogService: TestCatalogService,
    private readonly aiService: AiService,
    private readonly pdfParserService: PdfParserService,
    private readonly prisma: PrismaService,
  ) {}

  // GET /test-catalog
  @Get()
  @ApiOperation({ summary: "List test catalog (paginated)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "department", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("department") department?: string
  ) {
    return this.testCatalogService.findAll(user.tenantId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      category,
      department,
    });
  }

  // GET /test-catalog/search?q=
  @Get("search")
  @ApiOperation({ summary: "Search tests (order wizard / CommandPalette)" })
  @ApiQuery({ name: "q", required: true })
  search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q: string
  ) {
    return this.testCatalogService.search(user.tenantId, q ?? "");
  }

  // GET /test-catalog/by-category
  @Get("by-category")
  @ApiOperation({ summary: "Tests grouped by category (order wizard grid)" })
  findByCategory(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.findByCategory(user.tenantId);
  }

  // GET /test-catalog/ai-suggest?q=symptom
  @Get("ai-suggest")
  @ApiOperation({ summary: "AI-powered test suggestions based on symptoms" })
  @ApiQuery({ name: "q", required: true, description: "Symptom or clinical query" })
  @ApiQuery({ name: "top_k", required: false, type: Number })
  async aiSuggest(
    @Query("q") q: string,
    @Query("top_k") topK?: number
  ) {
    return this.aiService.suggestTests(q ?? "", topK ? Number(topK) : 8);
  }

  // GET /test-catalog/download-template
  @Get("download-template")
  @ApiOperation({ summary: "Download import template (Excel)" })
  async downloadTemplate(@Res() res: Response) {
    const XLSX = await import("xlsx");

    const headers = [
      "Test Code", "Type", "Investigations", "Methodology",
      "Sample Type", "Sample Volume", "Schedule", "TAT",
      "MRP", "B2B", "Cost Per test",
    ];
    const examples = [
      ["PT0001", "Pathology Type", "1,25 Di Hydroxy Vitamin D (Vitamin D3)", "LCMS", "Serum", "3 ml", "Daily", "48 hours", 2500, 1800, ""],
      ["PT0002", "Pathology Type", "17-alpha Hydroxy Progesterone (17-OHP)", "ELISA", "Serum", "3 ml", "3,5", "2 days", 1090, 650, ""],
      ["PT0003", "Pathology Type", "17-Ketosteroids", "Chromatography", "Urine (10 ml), 24 hrs Urine Volume", "10 ML", "3, 6", "3 days", 2200, 1100, ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    ws["!cols"] = [
      { wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 20 },
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Catalog Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"test-catalog-template.xlsx\"",
    });
    res.send(buffer);
  }

  // GET /test-catalog/download-dos
  @Get("download-dos")
  @ApiOperation({ summary: "Download Directory of Services (all active tests as Excel)" })
  async downloadDos(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const XLSX = await import("xlsx");
    const tests = await this.testCatalogService.getDosData(user.tenantId);

    const headers = [
      "Test Code", "Type", "Investigations", "Methodology",
      "Sample Type", "Sample Volume", "Schedule", "TAT",
      "MRP", "B2B", "Cost Per test",
    ];

    const formatTAT = (hours: number): string => {
      if (!hours) return "Daily";
      if (hours % 168 === 0) return `${hours / 168} weeks`;
      if (hours % 24 === 0) return `${hours / 24} days`;
      return `${hours} hours`;
    };

    const rows = tests.map((t) => [
      t.code ?? "",
      t.type ?? t.department ?? "",
      t.name,
      t.methodology ?? "",
      t.sampleType ?? "",
      t.sampleVolume ?? "",
      t.schedule ?? "Daily",
      formatTAT(t.turnaroundHours ?? 24),
      Number(t.price) || 0,
      Number(t.b2bPrice) || "",
      Number(t.cogs) || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 20 },
      { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Directory of Services");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="DOS_DELViON_${dateStr}.xlsx"`,
    });
    res.send(buf);
  }

  // POST /test-catalog (create single test)
  @Post()
  @ApiOperation({ summary: "Create a new test in catalog" })
  create(@Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.testCatalogService.create(dto, user.tenantId);
  }

  // DELETE /test-catalog/clear-all
  @Delete("clear-all")
  @ApiOperation({ summary: "Delete all tests for the tenant" })
  clearAll(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.clearAll(user.tenantId);
  }

  // POST /test-catalog/bulk-upload
  @Post("bulk-upload")
  @ApiOperation({ summary: "Bulk upload tests from Excel/CSV data" })
  bulkUpload(
    @Body() body: { tests: { code: string; name: string; department?: string; category?: string; type?: string; sampleType?: string; sampleVolume?: string; schedule?: string; tatHours?: number; price: number; b2bPrice?: number; methodology?: string; cptCode?: string; cogs?: number }[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.bulkUpload(user.tenantId, body.tests);
  }

  // POST /test-catalog/parse-pdf
  @Post("parse-pdf")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Parse a PDF rate card using AI" })
  @UseInterceptors(FileInterceptor("file", { dest: UPLOAD_DIR }))
  async parsePdf(@UploadedFile() file: Express.Multer.File) {
    const tests = await this.pdfParserService.parsePdfTestList(file.path);
    try { const fsModule = await import("fs"); fsModule.unlinkSync(file.path); } catch { /* ignore */ }
    return { tests };
  }

  // POST /test-catalog/classify-investigation-types
  @Post("classify-investigation-types")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Auto-classify tests as pathology vs imaging/investigation using name patterns" })
  classifyInvestigationTypes(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.classifyInvestigationTypes(user.tenantId);
  }

  // POST /test-catalog/seed-parameters
  @Post("seed-parameters")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Seed standard report parameters for common tests" })
  seedParameters(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.seedReportParameters(user.tenantId);
  }

  // GET /test-catalog/parameter-stats
  @Get("parameter-stats")
  @ApiOperation({ summary: "Get parameter seeding stats (counts by category, completion %)" })
  getParameterStats(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.getParameterStats(user.tenantId);
  }

  // ─── Profile / Panel Endpoints ──────────────────────────────────

  // POST /test-catalog/profiles
  @Post("profiles")
  @ApiOperation({ summary: "Create a test profile/panel" })
  createProfile(
    @Body() dto: { name: string; category?: string; department?: string; sampleType?: string; componentTestIds: string[]; discountAmount?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.createProfile(user.tenantId, {
      ...dto,
      discountAmount: dto.discountAmount ?? 0,
    });
  }

  // GET /test-catalog/profiles
  @Get("profiles")
  @ApiOperation({ summary: "List all test profiles/panels" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAllProfiles(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.testCatalogService.findAllProfiles(user.tenantId, {
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  // GET /test-catalog/profiles/:id
  @Get("profiles/:id")
  @ApiOperation({ summary: "Get a profile with its component tests" })
  findOneProfile(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.testCatalogService.findOneProfile(user.tenantId, id);
  }

  // PUT /test-catalog/profiles/:id
  @Put("profiles/:id")
  @ApiOperation({ summary: "Update a test profile/panel" })
  updateProfile(
    @Param("id") id: string,
    @Body() dto: { name?: string; category?: string; department?: string; sampleType?: string; componentTestIds?: string[]; discountAmount?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.updateProfile(id, user.tenantId, dto);
  }

  // ─── Template Management Endpoints ───────────────────────────

  // GET /test-catalog/template-status
  @Get("template-status")
  @ApiOperation({ summary: "Get template completeness summary for all tests" })
  getTemplateStatus(@CurrentUser() user: JwtPayload) {
    return this.testCatalogService.getTemplateStatus(user.tenantId);
  }

  // POST /test-catalog/seed-templates
  @Post("seed-templates")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Seed report templates for common tests (idempotent)" })
  async seedTemplates(@CurrentUser() user: JwtPayload) {
    return seedTestTemplates(this.prisma, user.tenantId);
  }

  // GET /test-catalog/:id/template
  @Get(":id/template")
  @ApiOperation({ summary: "Get full template data for a test" })
  getTemplate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.testCatalogService.getTemplate(user.tenantId, id);
  }

  // PUT /test-catalog/:id/template
  @Put(":id/template")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update report template metadata for a test" })
  updateTemplate(
    @Param("id") id: string,
    @Body() dto: { reportTitle?: string; reportIntro?: string; reportConclusion?: string; clinicalSignificance?: string; preparationNote?: string; collectionNote?: string; isTemplateComplete?: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.updateTemplate(user.tenantId, id, dto, user.sub);
  }

  // GET /test-catalog/:id/parameters
  @Get(":id/parameters")
  @ApiOperation({ summary: "Get report parameters for a test" })
  getParameters(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.testCatalogService.getParameters(user.tenantId, id);
  }

  // POST /test-catalog/:id/parameters
  @Post(":id/parameters")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Add a parameter to a test" })
  addParameter(
    @Param("id") id: string,
    @Body() dto: { name: string; fieldType?: string; unit?: string; sortOrder?: number; isMandatory?: boolean; clinicalNote?: string; abnormalityNote?: string; footerNote?: string; methodology?: string; specimenNote?: string; displayOnReport?: boolean; options?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.addParameter(user.tenantId, id, dto, user.sub);
  }

  // PUT /test-catalog/parameters/:paramId
  @Put("parameters/:paramId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update a report parameter" })
  updateParameter(
    @Param("paramId") paramId: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.updateParameter(user.tenantId, paramId, dto, user.sub);
  }

  // DELETE /test-catalog/parameters/:paramId
  @Delete("parameters/:paramId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Delete a report parameter" })
  deleteParameter(
    @Param("paramId") paramId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.deleteParameter(user.tenantId, paramId);
  }

  // POST /test-catalog/parameters/:paramId/reference-ranges
  @Post("parameters/:paramId/reference-ranges")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Add a reference range to a parameter" })
  addReferenceRange(
    @Param("paramId") paramId: string,
    @Body() dto: { genderFilter?: string; ageMinYears?: number; ageMaxYears?: number; lowNormal?: number; highNormal?: number; lowCritical?: number; highCritical?: number; unit?: string; notes?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.addReferenceRange(user.tenantId, paramId, dto);
  }

  // PUT /test-catalog/reference-ranges/:rangeId
  @Put("reference-ranges/:rangeId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update a reference range" })
  updateReferenceRange(
    @Param("rangeId") rangeId: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.updateReferenceRange(user.tenantId, rangeId, dto);
  }

  // DELETE /test-catalog/reference-ranges/:rangeId
  @Delete("reference-ranges/:rangeId")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Delete a reference range" })
  deleteReferenceRange(
    @Param("rangeId") rangeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.testCatalogService.deleteReferenceRange(user.tenantId, rangeId);
  }

  // ─── Single Test Endpoints ────────────────────────────────────

  // GET /test-catalog/:id
  @Get(":id")
  @ApiOperation({ summary: "Get a single test from the catalog" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.testCatalogService.findOne(user.tenantId, id);
  }

  // PUT /test-catalog/:id
  @Put(":id")
  @ApiOperation({ summary: "Update a test in catalog" })
  update(@Param("id") id: string, @Body() dto: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.testCatalogService.update(id, dto, user.tenantId);
  }

  // DELETE /test-catalog/:id
  @Delete(":id")
  @ApiOperation({ summary: "Deactivate a test in catalog" })
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.testCatalogService.deactivate(id, user.tenantId);
  }
}

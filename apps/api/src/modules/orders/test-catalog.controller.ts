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
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

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

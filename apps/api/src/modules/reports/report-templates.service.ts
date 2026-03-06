import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

export interface CreateReportTemplateDto {
  name: string;
  isDefault?: boolean;

  // Header
  showLogo?: boolean;
  logoUrl?: string;
  labName?: string;
  labAddress?: string;
  labPhone?: string;
  labEmail?: string;
  labRegNo?: string;
  accreditationNo?: string;

  // Layout
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  showHeader?: boolean;
  showFooter?: boolean;
  footerText?: string;
  showWatermark?: boolean;
  watermarkText?: string;
  showBarcodeOnReport?: boolean;
  showReferenceRange?: boolean;
  showInterpretation?: boolean;
  showDoctorSignature?: boolean;

  // Sections
  showPatientPhoto?: boolean;
  showDoctorName?: boolean;
  showOrgName?: boolean;
  showCollectionDate?: boolean;
  showReportDate?: boolean;

  // Custom HTML
  headerHtml?: string;
  footerHtml?: string;
}

export type UpdateReportTemplateDto = Partial<CreateReportTemplateDto>;

@Injectable()
export class ReportTemplatesService {
  private readonly logger = new Logger(ReportTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const templates = await this.prisma.reportTemplate.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return { data: templates };
  }

  async findDefault(tenantId: string) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });

    if (!template) {
      // Return null if no default template set yet
      return null;
    }

    return template;
  }

  async create(tenantId: string, dto: CreateReportTemplateDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException("Template name is required");
    }

    // If this is the first template or marked as default, handle default logic
    if (dto.isDefault) {
      await this.prisma.reportTemplate.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await this.prisma.reportTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        isDefault: dto.isDefault ?? false,

        // Header
        showLogo: dto.showLogo,
        logoUrl: dto.logoUrl,
        labName: dto.labName,
        labAddress: dto.labAddress,
        labPhone: dto.labPhone,
        labEmail: dto.labEmail,
        labRegNo: dto.labRegNo,
        accreditationNo: dto.accreditationNo,

        // Layout
        primaryColor: dto.primaryColor,
        fontFamily: dto.fontFamily,
        fontSize: dto.fontSize,
        showHeader: dto.showHeader,
        showFooter: dto.showFooter,
        footerText: dto.footerText,
        showWatermark: dto.showWatermark,
        watermarkText: dto.watermarkText,
        showBarcodeOnReport: dto.showBarcodeOnReport,
        showReferenceRange: dto.showReferenceRange,
        showInterpretation: dto.showInterpretation,
        showDoctorSignature: dto.showDoctorSignature,

        // Sections
        showPatientPhoto: dto.showPatientPhoto,
        showDoctorName: dto.showDoctorName,
        showOrgName: dto.showOrgName,
        showCollectionDate: dto.showCollectionDate,
        showReportDate: dto.showReportDate,

        // Custom HTML
        headerHtml: dto.headerHtml,
        footerHtml: dto.footerHtml,
      },
    });

    this.logger.log(
      `Created report template "${template.name}" (${template.id}) for tenant ${tenantId}`
    );

    return template;
  }

  async update(tenantId: string, id: string, dto: UpdateReportTemplateDto) {
    const existing = await this.prisma.reportTemplate.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException("Report template not found");
    }

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.showLogo !== undefined) updateData.showLogo = dto.showLogo;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.labName !== undefined) updateData.labName = dto.labName;
    if (dto.labAddress !== undefined) updateData.labAddress = dto.labAddress;
    if (dto.labPhone !== undefined) updateData.labPhone = dto.labPhone;
    if (dto.labEmail !== undefined) updateData.labEmail = dto.labEmail;
    if (dto.labRegNo !== undefined) updateData.labRegNo = dto.labRegNo;
    if (dto.accreditationNo !== undefined) updateData.accreditationNo = dto.accreditationNo;
    if (dto.primaryColor !== undefined) updateData.primaryColor = dto.primaryColor;
    if (dto.fontFamily !== undefined) updateData.fontFamily = dto.fontFamily;
    if (dto.fontSize !== undefined) updateData.fontSize = dto.fontSize;
    if (dto.showHeader !== undefined) updateData.showHeader = dto.showHeader;
    if (dto.showFooter !== undefined) updateData.showFooter = dto.showFooter;
    if (dto.footerText !== undefined) updateData.footerText = dto.footerText;
    if (dto.showWatermark !== undefined) updateData.showWatermark = dto.showWatermark;
    if (dto.watermarkText !== undefined) updateData.watermarkText = dto.watermarkText;
    if (dto.showBarcodeOnReport !== undefined) updateData.showBarcodeOnReport = dto.showBarcodeOnReport;
    if (dto.showReferenceRange !== undefined) updateData.showReferenceRange = dto.showReferenceRange;
    if (dto.showInterpretation !== undefined) updateData.showInterpretation = dto.showInterpretation;
    if (dto.showDoctorSignature !== undefined) updateData.showDoctorSignature = dto.showDoctorSignature;
    if (dto.showPatientPhoto !== undefined) updateData.showPatientPhoto = dto.showPatientPhoto;
    if (dto.showDoctorName !== undefined) updateData.showDoctorName = dto.showDoctorName;
    if (dto.showOrgName !== undefined) updateData.showOrgName = dto.showOrgName;
    if (dto.showCollectionDate !== undefined) updateData.showCollectionDate = dto.showCollectionDate;
    if (dto.showReportDate !== undefined) updateData.showReportDate = dto.showReportDate;
    if (dto.headerHtml !== undefined) updateData.headerHtml = dto.headerHtml;
    if (dto.footerHtml !== undefined) updateData.footerHtml = dto.footerHtml;

    const updated = await this.prisma.reportTemplate.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(
      `Updated report template "${updated.name}" (${id}) for tenant ${tenantId}`
    );

    return updated;
  }

  async setDefault(tenantId: string, id: string) {
    const existing = await this.prisma.reportTemplate.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException("Report template not found");
    }

    // Use transaction to unset all defaults and set the new one
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reportTemplate.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.reportTemplate.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    this.logger.log(
      `Set report template "${updated.name}" (${id}) as default for tenant ${tenantId}`
    );

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.reportTemplate.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException("Report template not found");
    }

    // Soft delete: set isActive=false
    const updated = await this.prisma.reportTemplate.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    });

    this.logger.log(
      `Soft-deleted report template "${updated.name}" (${id}) for tenant ${tenantId}`
    );

    return { message: "Template deleted successfully" };
  }

  // ─── AI Template Generation ─────────────────

  async generateTemplateWithAI(
    tenantId: string,
    instruction: string,
    templateType: string,
    existingHeader?: string,
    existingFooter?: string,
  ) {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        name: true,
        logoUrl: true,
        branches: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { phone: true, email: true, address: true },
        },
      },
    });

    const widgetConfig = await this.prisma.agentWidgetConfig
      .findFirst({
        where: { tenantId },
        select: {
          labName: true,
          labTagline: true,
          phoneNumber: true,
        },
      })
      .catch(() => null);

    const primaryBranch = tenant?.branches?.[0];
    const labName =
      widgetConfig?.labName ?? tenant?.name ?? "Diagnostic Laboratory";
    const labPhone = widgetConfig?.phoneNumber ?? primaryBranch?.phone ?? "";
    const labEmail = primaryBranch?.email ?? "";
    const labAddress = primaryBranch?.address ?? "";
    const labTagline = widgetConfig?.labTagline ?? "";

    const isRebuild = !!(existingHeader || existingFooter);
    const action = isRebuild ? "REBUILD" : "BUILD";

    const prompt = `You are a professional medical document designer specialising in clinical laboratory report templates.

LAB DETAILS:
- Lab Name: ${labName}
- Tagline: ${labTagline}
- Phone: ${labPhone}
- Email: ${labEmail}
- Address: ${labAddress}
- Report Type: ${templateType}

${isRebuild ? `EXISTING HEADER TO REBUILD:\n${existingHeader ?? "(none)"}\n\nEXISTING FOOTER TO REBUILD:\n${existingFooter ?? "(none)"}` : ""}

STAFF INSTRUCTION: "${instruction}"

${action} a professional, print-ready HTML report header and footer.

DESIGN REQUIREMENTS:
- Professional medical/clinical aesthetic
- Lab name prominently displayed
- Contact details in footer
- Use inline CSS only (no external stylesheets, no <style> tags)
- Must look professional when printed on A4 paper (210mm wide)
- Use a teal/dark color scheme (#0d4f52 as primary) unless staff requested otherwise
- Header should have: lab logo placeholder (if no logo), lab name, tagline, accreditation badges placeholder
- Footer should have: contact info, page number placeholder {{PAGE}}, report date placeholder {{DATE}}, "This report is computer generated" disclaimer
- Include patient info placeholders in header: {{PATIENT_NAME}}, {{PATIENT_AGE}}, {{PATIENT_GENDER}}, {{MRN}}, {{ORDER_NUMBER}}, {{DOCTOR_NAME}}, {{COLLECTION_DATE}}, {{REPORT_DATE}}
- Make it visually impressive — this is a key differentiator for the lab

Return ONLY valid JSON (no markdown, no explanation):
{
  "headerHtml": "complete self-contained HTML+CSS for the report header",
  "footerHtml": "complete self-contained HTML+CSS for the report footer",
  "summary": "1-2 sentence description of what was designed"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("");
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(clean);
  }
}

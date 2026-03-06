import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MeiliSearch } from "meilisearch";

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch | null = null;
  private isAvailable = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const host = process.env["MEILISEARCH_URL"] ?? "http://localhost:7700";
      const apiKey = process.env["MEILISEARCH_KEY"] ?? "delvion-meili-master-key";
      this.client = new MeiliSearch({ host, apiKey });

      // Test connection
      await this.client.health();
      this.isAvailable = true;

      // Setup indexes
      await this.setupIndexes();
      this.logger.log("Meilisearch connected successfully");
    } catch (e) {
      this.logger.warn(`Meilisearch not available: ${e instanceof Error ? e.message : String(e)}`);
      this.isAvailable = false;
    }
  }

  private async setupIndexes() {
    if (!this.client) return;
    try {
      await this.client.createIndex("patients", { primaryKey: "id" });
      await this.client.createIndex("test_catalog", { primaryKey: "id" });
      await this.client.createIndex("invoices", { primaryKey: "id" });

      await this.client.index("patients").updateFilterableAttributes(["tenantId"]);
      await this.client.index("patients").updateSearchableAttributes(["firstName", "lastName", "mrn", "phone", "email"]);

      await this.client.index("test_catalog").updateFilterableAttributes(["tenantId"]);
      await this.client.index("test_catalog").updateSearchableAttributes(["name", "code", "category", "department"]);

      await this.client.index("invoices").updateFilterableAttributes(["tenantId"]);
      await this.client.index("invoices").updateSearchableAttributes(["invoiceNumber", "patientName"]);
    } catch {
      // Indexes may already exist
    }
  }

  async indexPatient(patient: { id: string; tenantId: string; firstName: string; lastName: string; mrn: string; phone?: string | null; email?: string | null }) {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.client.index("patients").addDocuments([patient]);
    } catch {
      // Silently fail
    }
  }

  async indexTestCatalog(test: { id: string; tenantId: string; name: string; code: string; category: string; department: string }) {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.client.index("test_catalog").addDocuments([test]);
    } catch {
      // Silently fail
    }
  }

  async indexInvoice(invoice: { id: string; tenantId: string; invoiceNumber: string; patientName: string; total: number; status: string }) {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.client.index("invoices").addDocuments([invoice]);
    } catch {
      // Silently fail
    }
  }

  async searchPatients(query: string, tenantId: string, limit = 10) {
    if (this.isAvailable && this.client && query.trim()) {
      try {
        const result = await this.client.index("patients").search(query, {
          limit,
          filter: `tenantId = "${tenantId}"`,
        });
        return result.hits;
      } catch {
        // Fall through to Prisma
      }
    }
    return this.prisma.patient.findMany({
      where: {
        tenantId,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { mrn: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
        ],
      },
      take: limit,
    });
  }

  async searchTests(query: string, tenantId: string, limit = 10) {
    if (this.isAvailable && this.client && query.trim()) {
      try {
        const result = await this.client.index("test_catalog").search(query, {
          limit,
          filter: `tenantId = "${tenantId}"`,
        });
        return result.hits;
      } catch {
        // Fall through
      }
    }
    return this.prisma.testCatalog.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
    });
  }

  async searchInvoices(query: string, tenantId: string, limit = 10) {
    if (this.isAvailable && this.client && query.trim()) {
      try {
        const result = await this.client.index("invoices").search(query, {
          limit,
          filter: `tenantId = "${tenantId}"`,
        });
        return result.hits;
      } catch {
        // Fall through
      }
    }
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        invoiceNumber: { contains: query, mode: "insensitive" },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      take: limit,
    });
  }

  async unifiedSearch(query: string, tenantId: string, type?: string) {
    if (!query.trim()) return { patients: [], tests: [], invoices: [] };

    if (type === "patients") return { patients: await this.searchPatients(query, tenantId), tests: [], invoices: [] };
    if (type === "tests") return { patients: [], tests: await this.searchTests(query, tenantId), invoices: [] };
    if (type === "invoices") return { patients: [], tests: [], invoices: await this.searchInvoices(query, tenantId) };

    const [patients, tests, invoices] = await Promise.all([
      this.searchPatients(query, tenantId, 5),
      this.searchTests(query, tenantId, 5),
      this.searchInvoices(query, tenantId, 5),
    ]);
    return { patients, tests, invoices };
  }

  async reindexAll(tenantId: string) {
    const [patients, tests, invoices] = await Promise.all([
      this.prisma.patient.findMany({ where: { tenantId } }),
      this.prisma.testCatalog.findMany({ where: { tenantId } }),
      this.prisma.invoice.findMany({ where: { tenantId }, include: { patient: { select: { firstName: true, lastName: true } } } }),
    ]);

    await Promise.all([
      ...patients.map((p) => this.indexPatient({ id: p.id, tenantId: p.tenantId, firstName: p.firstName, lastName: p.lastName, mrn: p.mrn, phone: p.phone, email: p.email })),
      ...tests.map((t) => this.indexTestCatalog({ id: t.id, tenantId: t.tenantId, name: t.name, code: t.code, category: t.category, department: t.department })),
      ...invoices.map((i) => this.indexInvoice({ id: i.id, tenantId: i.tenantId, invoiceNumber: i.invoiceNumber, patientName: `${i.patient.firstName} ${i.patient.lastName}`, total: Number(i.total), status: i.status })),
    ]);

    return { reindexed: { patients: patients.length, tests: tests.length, invoices: invoices.length } };
  }
}

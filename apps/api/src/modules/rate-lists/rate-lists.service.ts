import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RateListsService {
  private readonly logger = new Logger(RateListsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, listType?: string) {
    const lists = await this.prisma.rateList.findMany({
      where: {
        tenantId,
        ...(listType ? { listType } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return lists.map((l) => ({
      ...l,
      testsCount: l._count.items,
    }));
  }

  async findOne(id: string, tenantId: string) {
    const list = await this.prisma.rateList.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            testCatalog: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                department: true,
                price: true,
                sampleType: true,
                turnaroundHours: true,
                cptCode: true,
                cogs: true,
              },
            },
          },
        },
      },
    });
    if (!list) throw new NotFoundException("Rate list not found");
    return list;
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      isDefault?: boolean;
      listType?: string;
      startDate?: string;
      endDate?: string;
      copiedFromId?: string;
    },
  ) {
    if (data.isDefault) {
      await this.prisma.rateList.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rateList = await this.prisma.rateList.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false,
        listType: data.listType || "PRICE_LIST",
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        copiedFromId: data.copiedFromId || null,
      },
    });

    if (data.copiedFromId) {
      const sourceItems = await this.prisma.rateListItem.findMany({
        where: { rateListId: data.copiedFromId },
      });
      if (sourceItems.length > 0) {
        await this.prisma.rateListItem.createMany({
          data: sourceItems.map((item) => ({
            rateListId: rateList.id,
            testCatalogId: item.testCatalogId,
            price: item.price,
            isActive: item.isActive,
          })),
          skipDuplicates: true,
        });
        this.logger.log(`Copied ${sourceItems.length} items from list ${data.copiedFromId}`);
      }
    } else {
      const tests = await this.prisma.testCatalog.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, price: true },
      });
      if (tests.length > 0) {
        await this.prisma.rateListItem.createMany({
          data: tests.map((t) => ({
            rateListId: rateList.id,
            testCatalogId: t.id,
            price: t.price,
          })),
          skipDuplicates: true,
        });
        this.logger.log(`Auto-seeded rate list "${data.name}" with ${tests.length} items`);
      }
    }

    return rateList;
  }

  async update(
    id: string,
    tenantId: string,
    data: { name?: string; description?: string; isActive?: boolean; startDate?: string | null; endDate?: string | null },
  ) {
    const list = await this.prisma.rateList.findFirst({ where: { id, tenantId } });
    if (!list) throw new NotFoundException("Rate list not found");
    return this.prisma.rateList.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const list = await this.prisma.rateList.findFirst({ where: { id, tenantId } });
    if (!list) throw new NotFoundException("Rate list not found");
    if (list.isDefault) throw new BadRequestException("Cannot delete default rate list");
    await this.prisma.rateList.delete({ where: { id } });
    return { success: true };
  }

  async setDefault(id: string, tenantId: string) {
    const list = await this.prisma.rateList.findFirst({ where: { id, tenantId } });
    if (!list) throw new NotFoundException("Rate list not found");
    await this.prisma.$transaction([
      this.prisma.rateList.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.rateList.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return { success: true };
  }

  async getItems(rateListId: string, tenantId: string) {
    const list = await this.prisma.rateList.findFirst({
      where: { id: rateListId, tenantId },
    });
    if (!list) throw new NotFoundException("Rate list not found");

    return this.prisma.rateListItem.findMany({
      where: { rateListId },
      include: {
        testCatalog: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            department: true,
            price: true,
            sampleType: true,
            turnaroundHours: true,
          },
        },
      },
      orderBy: { testCatalog: { name: "asc" } },
    });
  }

  async bulkUpdatePrices(
    rateListId: string,
    tenantId: string,
    userId: string,
    items: { testCatalogId: string; price: number; isActive?: boolean }[],
  ) {
    const list = await this.prisma.rateList.findFirst({
      where: { id: rateListId, tenantId },
    });
    if (!list) throw new NotFoundException("Rate list not found");

    // Validate prices are non-negative
    const negatives = items.filter((i) => i.price < 0);
    if (negatives.length > 0) {
      throw new BadRequestException("Price cannot be negative");
    }

    // Fetch current prices for audit log
    const currentItems = await this.prisma.rateListItem.findMany({
      where: { rateListId, testCatalogId: { in: items.map((i) => i.testCatalogId) } },
    });
    const currentPriceMap = new Map(currentItems.map((i) => [i.testCatalogId, Number(i.price)]));

    const ops = items.map((item) =>
      this.prisma.rateListItem.upsert({
        where: {
          rateListId_testCatalogId: {
            rateListId,
            testCatalogId: item.testCatalogId,
          },
        },
        update: {
          price: item.price,
          ...(item.isActive !== undefined ? { isActive: item.isActive } : {}),
        },
        create: {
          rateListId,
          testCatalogId: item.testCatalogId,
          price: item.price,
          isActive: item.isActive ?? true,
        },
      }),
    );

    await this.prisma.$transaction(ops);

    // Record audit logs for price changes
    const auditEntries = items
      .filter((item) => {
        const oldPrice = currentPriceMap.get(item.testCatalogId);
        return oldPrice !== undefined && oldPrice !== item.price;
      })
      .map((item) => ({
        tenantId,
        rateListId,
        testCatalogId: item.testCatalogId,
        oldPrice: currentPriceMap.get(item.testCatalogId)!,
        newPrice: item.price,
        changedBy: userId,
      }));

    if (auditEntries.length > 0) {
      await this.prisma.ratePriceAuditLog.createMany({ data: auditEntries });
    }

    return { updated: items.length, audited: auditEntries.length };
  }

  async getAuditLog(rateListId: string, tenantId: string) {
    return this.prisma.ratePriceAuditLog.findMany({
      where: { rateListId, tenantId },
      orderBy: { changedAt: "desc" },
      take: 500,
    });
  }

  async getDefaultRateList(tenantId: string) {
    const list = await this.prisma.rateList.findFirst({
      where: { tenantId, isDefault: true },
      include: {
        items: {
          where: { isActive: true },
          include: {
            testCatalog: {
              select: { id: true, name: true, code: true, price: true },
            },
          },
        },
      },
    });
    return list;
  }

  async getTestPrice(
    testCatalogId: string,
    tenantId: string,
    rateListId?: string,
  ): Promise<number> {
    if (rateListId) {
      const item = await this.prisma.rateListItem.findUnique({
        where: {
          rateListId_testCatalogId: { rateListId, testCatalogId },
        },
      });
      if (item) return Number(item.price);
    }

    const defaultList = await this.prisma.rateList.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (defaultList) {
      const item = await this.prisma.rateListItem.findUnique({
        where: {
          rateListId_testCatalogId: {
            rateListId: defaultList.id,
            testCatalogId,
          },
        },
      });
      if (item) return Number(item.price);
    }

    const test = await this.prisma.testCatalog.findUnique({
      where: { id: testCatalogId },
      select: { price: true },
    });
    return test ? Number(test.price) : 0;
  }

  async getDownloadData(rateListId: string, tenantId: string) {
    const list = await this.prisma.rateList.findFirst({
      where: { id: rateListId, tenantId },
    });
    if (!list) throw new NotFoundException("Rate list not found");

    const items = await this.prisma.rateListItem.findMany({
      where: { rateListId },
      include: {
        testCatalog: {
          select: {
            code: true,
            name: true,
            department: true,
            category: true,
            sampleType: true,
            turnaroundHours: true,
            price: true,
          },
        },
      },
      orderBy: { testCatalog: { name: "asc" } },
    });

    return {
      listName: list.name,
      items: items.map((i) => ({
        code: i.testCatalog.code,
        name: i.testCatalog.name,
        department: i.testCatalog.department,
        category: i.testCatalog.category,
        sampleType: i.testCatalog.sampleType ?? "",
        tat: i.testCatalog.turnaroundHours,
        mrp: Number(i.testCatalog.price),
        listPrice: Number(i.price),
        concession: Number(i.testCatalog.price) > 0
          ? (((Number(i.testCatalog.price) - Number(i.price)) / Number(i.testCatalog.price)) * 100).toFixed(1)
          : "0.0",
        isActive: i.isActive,
      })),
    };
  }

  async uploadRateList(
    rateListId: string,
    fileBuffer: Buffer,
    userId: string,
    tenantId: string,
  ) {
    const wb = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new BadRequestException("No sheets found in file");
    const ws = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as (string | number)[][];
    if (rows.length < 2) throw new BadRequestException("Empty file");

    const headerRow = rows[0];
    if (!headerRow) throw new BadRequestException("Empty file");
    const headers = headerRow.map((h) => String(h).toLowerCase().trim());
    const codeCol = headers.findIndex((h) => h.includes("code"));
    const priceCol = headers.findIndex((h) => h.includes("list price") || h.includes("price ("));
    // Fallback: column index 7 is the list price column in our template
    const effectivePriceCol = priceCol >= 0 ? priceCol : 7;

    if (codeCol < 0) throw new BadRequestException("Cannot find 'Code' column in uploaded file");

    const rateList = await this.prisma.rateList.findFirst({
      where: { id: rateListId, tenantId },
    });
    if (!rateList) throw new NotFoundException("Rate list not found");

    let updated = 0;
    let skipped = 0;
    const auditChanges: {
      tenantId: string;
      rateListId: string;
      testCatalogId: string;
      oldPrice: number;
      newPrice: number;
      changedBy: string;
    }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const code = String(row[codeCol] ?? "").trim();
      const rawPrice = String(row[effectivePriceCol] ?? "0").replace(/[₹,\s]/g, "");
      const newPrice = parseFloat(rawPrice);

      if (!code || isNaN(newPrice) || newPrice <= 0) {
        skipped++;
        continue;
      }

      const test = await this.prisma.testCatalog.findFirst({
        where: { code, tenantId },
      });
      if (!test) {
        skipped++;
        continue;
      }

      const existing = await this.prisma.rateListItem.findUnique({
        where: { rateListId_testCatalogId: { rateListId, testCatalogId: test.id } },
      });

      const oldPrice = existing ? Number(existing.price) : Number(test.price);

      await this.prisma.rateListItem.upsert({
        where: { rateListId_testCatalogId: { rateListId, testCatalogId: test.id } },
        update: { price: newPrice },
        create: { rateListId, testCatalogId: test.id, price: newPrice, isActive: true },
      });

      if (oldPrice !== newPrice) {
        auditChanges.push({
          tenantId,
          rateListId,
          testCatalogId: test.id,
          oldPrice,
          newPrice,
          changedBy: userId,
        });
      }
      updated++;
    }

    if (auditChanges.length > 0) {
      await this.prisma.ratePriceAuditLog.createMany({ data: auditChanges });
    }

    return { updated, skipped, auditEntries: auditChanges.length };
  }
}

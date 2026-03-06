import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: Implement inventory service methods
  async findAll(tenantId: string): Promise<unknown[]> {
    return [];
  }
}

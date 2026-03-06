import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: Implement insurance service methods
  async findAll(tenantId: string): Promise<unknown[]> {
    return [];
  }
}

import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "@delvion/types";

interface RequestWithTenant extends Request {
  tenantId: string;
  user?: JwtPayload;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(
    req: RequestWithTenant,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    // Strategy 1: From JWT payload (most common)
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      return next();
    }

    // Strategy 2: From x-tenant-id header
    const headerTenantId = req.headers["x-tenant-id"];
    if (typeof headerTenantId === "string") {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: headerTenantId, isActive: true },
        select: { id: true },
      });
      if (!tenant) {
        throw new NotFoundException(`Tenant not found`);
      }
      req.tenantId = tenant.id;
      return next();
    }

    // Strategy 3: From subdomain (e.g., acme.delvion.com)
    const host = req.hostname;
    const subdomain = host.split(".")[0];
    if (subdomain && subdomain !== "www" && subdomain !== "api") {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: subdomain, isActive: true },
        select: { id: true },
      });
      if (tenant) {
        req.tenantId = tenant.id;
        return next();
      }
    }

    next();
  }
}

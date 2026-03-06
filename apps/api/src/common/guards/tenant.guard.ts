import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload; tenantId: string }>();

    const user = request.user;
    if (!user) return false;

    // Super admin can access any tenant
    if (user.role === Role.SUPER_ADMIN) return true;

    // TenantMiddleware runs before JWT guard, so req.tenantId may not be set yet
    // for direct JWT-authenticated requests (no x-tenant-id header / subdomain).
    // Fall back to the tenant from the JWT payload itself.
    if (!request.tenantId) {
      request.tenantId = user.tenantId;
    }

    // All other roles must belong to the request tenant
    if (user.tenantId !== request.tenantId) {
      throw new ForbiddenException("Cross-tenant access denied");
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const FEATURE_KEY = 'requiredFeature';
export const RequireFeature = (flagKey: string) => SetMetadata(FEATURE_KEY, flagKey);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.get<string | undefined>(
      FEATURE_KEY,
      context.getHandler(),
    );
    if (!flagKey) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { tenantId?: string } }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) return true; // Super admin bypass

    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });
    if (!flag) return true;

    const override = await this.prisma.featureFlagOverride.findUnique({
      where: { flagId_tenantId: { flagId: flag.id, tenantId } },
    });

    const enabled = override !== null ? override.value : flag.defaultValue;

    if (!enabled) {
      throw new ForbiddenException(
        `Feature '${flagKey}' is not available on your current plan. Please upgrade to access this feature.`,
      );
    }

    return true;
  }
}

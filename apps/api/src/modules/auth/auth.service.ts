import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto/login.dto";
import type { AuthResponseDto } from "./dto/auth-response.dto";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const RESET_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  private async redisSet(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) await this.redis.set(key, value, "EX", ttl);
      else await this.redis.set(key, value);
    } catch {
      // Redis unavailable — fall back to DB refreshToken field
    }
  }

  private async redisGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  private async redisDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // Redis unavailable — ignore
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: {
        tenant: { select: { isActive: true, plan: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException("Tenant account is suspended");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      tenantId: user.tenantId,
    };

    const { accessToken, refreshToken } = await this.generateTokens(payload);

    // Store hashed refresh token in Redis (7-day TTL) + DB fallback
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.redisSet(`refresh:${user.id}`, hashedRefresh, REFRESH_TTL_SECONDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as Role,
        tenantId: user.tenantId,
      },
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: JwtPayload;

    try {
      payload = this.jwt.verify<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET", "changeme"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    let storedHash = await this.redisGet(`refresh:${user.id}`);
    // Fallback to DB if Redis unavailable
    if (!storedHash) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { refreshToken: true },
      });
      storedHash = dbUser?.refreshToken ?? null;
    }
    if (!storedHash) {
      throw new UnauthorizedException("Refresh token expired or revoked");
    }

    const isValid = await bcrypt.compare(dto.refreshToken, storedHash);
    if (!isValid) {
      // Potential token reuse — revoke
      await this.redisDel(`refresh:${user.id}`);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      tenantId: user.tenantId,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await this.generateTokens(newPayload);

    const hashedRefresh = await bcrypt.hash(newRefreshToken, 10);
    await this.redisSet(`refresh:${user.id}`, hashedRefresh, REFRESH_TTL_SECONDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as Role,
        tenantId: user.tenantId,
      },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.redisDel(`refresh:${userId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async getProfile(userId: string): Promise<AuthResponseDto["user"]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as Role,
      tenantId: user.tenantId,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens on password change
    await this.redisDel(`refresh:${userId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      select: { id: true, email: true, firstName: true },
    });

    // Always return success to prevent email enumeration
    if (!user) return;

    const token = nanoid(64);
    await this.redisSet(`pwd_reset:${token}`, user.id, RESET_TTL_SECONDS);

    await this.email.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.redisGet(`pwd_reset:${dto.token}`);
    if (!userId) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, refreshToken: null },
    });

    // Consume the reset token and revoke refresh tokens
    await Promise.all([
      this.redisDel(`pwd_reset:${dto.token}`),
      this.redisDel(`refresh:${userId}`),
    ]);
  }

  private async generateTokens(
    payload: JwtPayload
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>("JWT_SECRET", "changeme"),
        expiresIn: this.config.get<string>("JWT_EXPIRY", "24h"),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET", "changeme"),
        expiresIn: "7d",
      }),
    ]);

    return { accessToken, refreshToken };
  }
}

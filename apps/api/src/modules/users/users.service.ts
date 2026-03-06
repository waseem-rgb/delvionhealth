import { Injectable, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import type { Role } from "@delvion/types";

interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

interface InviteUserDto {
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  branchId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async findAll(tenantId: string, query: UserQuery = {}) {
    const { page = 1, limit = 20, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(role ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true, lastLoginAt: true, createdAt: true,
          _count: { select: { auditLogs: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async invite(dto: InviteUserDto, tenantId: string) {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException("User with this email already exists");

    const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}@1`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        passwordHash,
        isActive: true,
      },
    });

    try {
      await this.email.sendInviteEmail(dto.email, dto.firstName, tempPassword);
    } catch {
      // Email failure is non-fatal
    }

    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName };
  }

  async updateRole(id: string, role: Role, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role === 'SUPER_ADMIN') throw new BadRequestException("Cannot change SUPER_ADMIN role");
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  async updateStatus(id: string, isActive: boolean, tenantId: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException("Cannot deactivate yourself");
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException("User not found");
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }
}

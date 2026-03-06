import { z } from "zod";

export const TenantConfigSchema = z.object({
  maxUsers: z.number().default(50),
  maxBranches: z.number().default(5),
  features: z.array(z.string()).default([]),
  branding: z
    .object({
      logoUrl: z.string().optional(),
      primaryColor: z.string().default("#1B4F8A"),
    })
    .optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().default("INR"),
  reportHeader: z.string().optional(),
  reportFooter: z.string().optional(),
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;

export interface TenantContext {
  tenantId: string;
  branchId?: string;
  plan: string;
  isActive: boolean;
  config: TenantConfig;
}

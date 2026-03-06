import { z } from "zod";
export declare const TenantConfigSchema: z.ZodObject<{
    maxUsers: z.ZodDefault<z.ZodNumber>;
    maxBranches: z.ZodDefault<z.ZodNumber>;
    features: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    branding: z.ZodOptional<z.ZodObject<{
        logoUrl: z.ZodOptional<z.ZodString>;
        primaryColor: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        primaryColor: string;
        logoUrl?: string | undefined;
    }, {
        logoUrl?: string | undefined;
        primaryColor?: string | undefined;
    }>>;
    timezone: z.ZodDefault<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    reportHeader: z.ZodOptional<z.ZodString>;
    reportFooter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    maxUsers: number;
    maxBranches: number;
    features: string[];
    timezone: string;
    currency: string;
    branding?: {
        primaryColor: string;
        logoUrl?: string | undefined;
    } | undefined;
    reportHeader?: string | undefined;
    reportFooter?: string | undefined;
}, {
    maxUsers?: number | undefined;
    maxBranches?: number | undefined;
    features?: string[] | undefined;
    branding?: {
        logoUrl?: string | undefined;
        primaryColor?: string | undefined;
    } | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    reportHeader?: string | undefined;
    reportFooter?: string | undefined;
}>;
export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export interface TenantContext {
    tenantId: string;
    branchId?: string;
    plan: string;
    isActive: boolean;
    config: TenantConfig;
}
//# sourceMappingURL=tenant.d.ts.map
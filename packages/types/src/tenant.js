"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantConfigSchema = void 0;
const zod_1 = require("zod");
exports.TenantConfigSchema = zod_1.z.object({
    maxUsers: zod_1.z.number().default(50),
    maxBranches: zod_1.z.number().default(5),
    features: zod_1.z.array(zod_1.z.string()).default([]),
    branding: zod_1.z
        .object({
        logoUrl: zod_1.z.string().optional(),
        primaryColor: zod_1.z.string().default("#1B4F8A"),
    })
        .optional(),
    timezone: zod_1.z.string().default("UTC"),
    currency: zod_1.z.string().default("INR"),
    reportHeader: zod_1.z.string().optional(),
    reportFooter: zod_1.z.string().optional(),
});
//# sourceMappingURL=tenant.js.map
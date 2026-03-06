"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrderSchema = exports.CreateOrderItemSchema = void 0;
const zod_1 = require("zod");
exports.CreateOrderItemSchema = zod_1.z.object({
    testCatalogId: zod_1.z.string(),
    quantity: zod_1.z.number().int().min(1).default(1),
    discount: zod_1.z.number().min(0).max(100).default(0),
});
exports.CreateOrderSchema = zod_1.z.object({
    patientId: zod_1.z.string(),
    branchId: zod_1.z.string(),
    priority: zod_1.z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
    items: zod_1.z.array(exports.CreateOrderItemSchema).min(1),
    discountAmount: zod_1.z.number().min(0).default(0),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=order.js.map
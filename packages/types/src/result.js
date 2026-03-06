"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterResultSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.EnterResultSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    orderItemId: zod_1.z.string(),
    sampleId: zod_1.z.string(),
    value: zod_1.z.string(),
    unit: zod_1.z.string().optional(),
    referenceRange: zod_1.z.string().optional(),
    interpretation: zod_1.z.nativeEnum(enums_1.ResultInterpretation),
    flags: zod_1.z.string().optional(),
    autoVerified: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=result.js.map
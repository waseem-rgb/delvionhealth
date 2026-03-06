"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSampleStatusSchema = exports.AccessionSampleSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.AccessionSampleSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    type: zod_1.z.string(),
    collectedById: zod_1.z.string(),
    location: zod_1.z.string().optional(),
    branchId: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
});
exports.UpdateSampleStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(enums_1.SampleStatus),
    location: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=sample.js.map
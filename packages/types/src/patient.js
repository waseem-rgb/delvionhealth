"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientSchema = void 0;
const zod_1 = require("zod");
exports.PatientSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    dob: zod_1.z.string().datetime().or(zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    gender: zod_1.z.enum(["MALE", "FEMALE", "OTHER"]),
    phone: zod_1.z.string().min(10),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    insuranceId: zod_1.z.string().optional(),
    referringDoctorId: zod_1.z.string().optional(),
    branchId: zod_1.z.string(),
});
//# sourceMappingURL=patient.js.map
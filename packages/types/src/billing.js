"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordPaymentSchema = exports.CreateInvoiceSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.CreateInvoiceSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    patientId: zod_1.z.string(),
    dueDate: zod_1.z.string().datetime(),
});
exports.RecordPaymentSchema = zod_1.z.object({
    invoiceId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    method: zod_1.z.nativeEnum(enums_1.PaymentMethod),
    reference: zod_1.z.string().optional(),
});
//# sourceMappingURL=billing.js.map
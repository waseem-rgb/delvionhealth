import { z } from "zod";
import { PaymentMethod } from "./enums";
export declare const CreateInvoiceSchema: z.ZodObject<{
    orderId: z.ZodString;
    patientId: z.ZodString;
    dueDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    patientId: string;
    orderId: string;
    dueDate: string;
}, {
    patientId: string;
    orderId: string;
    dueDate: string;
}>;
export declare const RecordPaymentSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodNumber;
    method: z.ZodNativeEnum<typeof PaymentMethod>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | undefined;
}, {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | undefined;
}>;
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof RecordPaymentSchema>;
//# sourceMappingURL=billing.d.ts.map
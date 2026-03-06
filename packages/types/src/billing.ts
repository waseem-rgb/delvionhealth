import { z } from "zod";
import { PaymentMethod } from "./enums";

export const CreateInvoiceSchema = z.object({
  orderId: z.string(),
  patientId: z.string(),
  dueDate: z.string().datetime(),
});

export const RecordPaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof RecordPaymentSchema>;

import { z } from "zod";
import { OrderStatus } from "./enums";

export const CreateOrderItemSchema = z.object({
  testCatalogId: z.string(),
  quantity: z.number().int().min(1).default(1),
  discount: z.number().min(0).max(100).default(0),
});

export const CreateOrderSchema = z.object({
  patientId: z.string(),
  branchId: z.string(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  items: z.array(CreateOrderItemSchema).min(1),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  patientName: string;
  totalAmount: number;
  netAmount: number;
  createdAt: string;
  itemCount: number;
}

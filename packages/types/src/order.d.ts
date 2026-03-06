import { z } from "zod";
import { OrderStatus } from "./enums";
export declare const CreateOrderItemSchema: z.ZodObject<{
    testCatalogId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    discount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    testCatalogId: string;
    quantity: number;
    discount: number;
}, {
    testCatalogId: string;
    quantity?: number | undefined;
    discount?: number | undefined;
}>;
export declare const CreateOrderSchema: z.ZodObject<{
    patientId: z.ZodString;
    branchId: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["ROUTINE", "URGENT", "STAT"]>>;
    items: z.ZodArray<z.ZodObject<{
        testCatalogId: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
        discount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        testCatalogId: string;
        quantity: number;
        discount: number;
    }, {
        testCatalogId: string;
        quantity?: number | undefined;
        discount?: number | undefined;
    }>, "many">;
    discountAmount: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    priority: "ROUTINE" | "URGENT" | "STAT";
    items: {
        testCatalogId: string;
        quantity: number;
        discount: number;
    }[];
    branchId: string;
    patientId: string;
    discountAmount: number;
    notes?: string | undefined;
}, {
    items: {
        testCatalogId: string;
        quantity?: number | undefined;
        discount?: number | undefined;
    }[];
    branchId: string;
    patientId: string;
    priority?: "ROUTINE" | "URGENT" | "STAT" | undefined;
    discountAmount?: number | undefined;
    notes?: string | undefined;
}>;
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
//# sourceMappingURL=order.d.ts.map
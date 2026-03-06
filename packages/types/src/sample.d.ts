import { z } from "zod";
import { SampleStatus } from "./enums";
export declare const AccessionSampleSchema: z.ZodObject<{
    orderId: z.ZodString;
    type: z.ZodString;
    collectedById: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    branchId: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    branchId: string;
    orderId: string;
    collectedById: string;
    notes?: string | undefined;
    location?: string | undefined;
}, {
    type: string;
    branchId: string;
    orderId: string;
    collectedById: string;
    notes?: string | undefined;
    location?: string | undefined;
}>;
export declare const UpdateSampleStatusSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof SampleStatus>;
    location: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: SampleStatus;
    notes?: string | undefined;
    location?: string | undefined;
}, {
    status: SampleStatus;
    notes?: string | undefined;
    location?: string | undefined;
}>;
export type AccessionSampleDto = z.infer<typeof AccessionSampleSchema>;
export type UpdateSampleStatusDto = z.infer<typeof UpdateSampleStatusSchema>;
export interface SampleTracking {
    id: string;
    barcodeId: string;
    type: string;
    status: SampleStatus;
    location?: string;
    collectedAt: string;
    movements: SampleMovementEntry[];
}
export interface SampleMovementEntry {
    fromLocation?: string;
    toLocation: string;
    movedAt: string;
    movedBy: string;
    notes?: string;
}
//# sourceMappingURL=sample.d.ts.map
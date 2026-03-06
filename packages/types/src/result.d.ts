import { z } from "zod";
import { ResultInterpretation } from "./enums";
export declare const EnterResultSchema: z.ZodObject<{
    orderId: z.ZodString;
    orderItemId: z.ZodString;
    sampleId: z.ZodString;
    value: z.ZodString;
    unit: z.ZodOptional<z.ZodString>;
    referenceRange: z.ZodOptional<z.ZodString>;
    interpretation: z.ZodNativeEnum<typeof ResultInterpretation>;
    flags: z.ZodOptional<z.ZodString>;
    autoVerified: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    value: string;
    orderId: string;
    orderItemId: string;
    sampleId: string;
    interpretation: ResultInterpretation;
    autoVerified: boolean;
    referenceRange?: string | undefined;
    unit?: string | undefined;
    flags?: string | undefined;
}, {
    value: string;
    orderId: string;
    orderItemId: string;
    sampleId: string;
    interpretation: ResultInterpretation;
    referenceRange?: string | undefined;
    unit?: string | undefined;
    flags?: string | undefined;
    autoVerified?: boolean | undefined;
}>;
export type EnterResultDto = z.infer<typeof EnterResultSchema>;
//# sourceMappingURL=result.d.ts.map
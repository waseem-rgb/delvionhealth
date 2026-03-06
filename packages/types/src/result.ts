import { z } from "zod";
import { ResultInterpretation } from "./enums";

export const EnterResultSchema = z.object({
  orderId: z.string(),
  orderItemId: z.string(),
  sampleId: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  interpretation: z.nativeEnum(ResultInterpretation),
  flags: z.string().optional(),
  autoVerified: z.boolean().default(false),
});

export type EnterResultDto = z.infer<typeof EnterResultSchema>;

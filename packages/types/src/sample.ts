import { z } from "zod";
import { SampleStatus } from "./enums";

export const AccessionSampleSchema = z.object({
  orderId: z.string(),
  type: z.string(),
  collectedById: z.string(),
  location: z.string().optional(),
  branchId: z.string(),
  notes: z.string().optional(),
});

export const UpdateSampleStatusSchema = z.object({
  status: z.nativeEnum(SampleStatus),
  location: z.string().optional(),
  notes: z.string().optional(),
});

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

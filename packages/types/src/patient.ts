import { z } from "zod";

export const PatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  address: z.string().optional(),
  insuranceId: z.string().optional(),
  referringDoctorId: z.string().optional(),
  branchId: z.string(),
});

export type CreatePatientDto = z.infer<typeof PatientSchema>;

export interface PatientSearchResult {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email?: string;
}

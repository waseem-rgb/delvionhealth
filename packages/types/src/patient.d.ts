import { z } from "zod";
export declare const PatientSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    dob: z.ZodUnion<[z.ZodString, z.ZodString]>;
    gender: z.ZodEnum<["MALE", "FEMALE", "OTHER"]>;
    phone: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    insuranceId: z.ZodOptional<z.ZodString>;
    referringDoctorId: z.ZodOptional<z.ZodString>;
    branchId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    phone: string;
    dob: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    branchId: string;
    email?: string | undefined;
    address?: string | undefined;
    insuranceId?: string | undefined;
    referringDoctorId?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    phone: string;
    dob: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    branchId: string;
    email?: string | undefined;
    address?: string | undefined;
    insuranceId?: string | undefined;
    referringDoctorId?: string | undefined;
}>;
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
//# sourceMappingURL=patient.d.ts.map
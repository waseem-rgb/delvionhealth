import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

export class CreatePatientDto {
  @ApiProperty({ example: "Aisha" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: "Khan" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: "1990-05-15" })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone!: string;

  @ApiPropertyOptional({ description: "Branch ID the patient is registered under" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: "aisha.khan@email.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "42, MG Road, Bengaluru" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: "Bengaluru" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: "Karnataka" })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: "560001" })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ example: "+919876543211" })
  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: "Aadhaar number" })
  @IsOptional()
  @IsString()
  aadhaar?: string;

  @ApiPropertyOptional({ description: "Patient type: Regular, VIP, Staff, Insurance" })
  @IsOptional()
  @IsString()
  patientType?: string;

  @ApiPropertyOptional({ description: "Additional notes" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "Rate list ID for pricing" })
  @IsOptional()
  @IsString()
  rateListId?: string;

  @ApiPropertyOptional({ description: "Referral doctor ID (CRM doctor)" })
  @IsOptional()
  @IsString()
  referralDoctorId?: string;

  @ApiPropertyOptional({ description: "Designation (Mr./Mrs./Ms./Dr./Baby)" })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: "Organization ID (for B2B)" })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: "Phone belongs to (Patient/Relative)" })
  @IsOptional()
  @IsString()
  phoneBelongsTo?: string;

  @ApiPropertyOptional({ description: "Is hospitalized" })
  @IsOptional()
  isHospitalized?: boolean;

  @ApiPropertyOptional({ description: "Patient category (OPD/IPD/Emergency)" })
  @IsOptional()
  @IsString()
  patientCategory?: string;

  @ApiPropertyOptional({ description: "Allergies" })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: "Chief complaint" })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: "Insurance provider ID" })
  @IsOptional()
  @IsString()
  insuranceId?: string;

  @ApiPropertyOptional({ description: "Referring doctor (User ID)" })
  @IsOptional()
  @IsString()
  referringDoctorId?: string;

  @ApiPropertyOptional({ description: "Report delivery mode: AUTO, MANUAL, DOWNLOAD", example: "AUTO" })
  @IsOptional()
  @IsString()
  reportDeliveryMode?: string;

  @ApiPropertyOptional({ description: "Preferred delivery channels: WHATSAPP, EMAIL, SMS", type: [String] })
  @IsOptional()
  preferredChannel?: string[];

  @ApiPropertyOptional({ description: "Mobile for report delivery (if different from primary)" })
  @IsOptional()
  @IsString()
  reportMobile?: string;

  @ApiPropertyOptional({ description: "Email for report delivery (if different from primary)" })
  @IsOptional()
  @IsEmail()
  reportEmail?: string;

  @ApiPropertyOptional({ description: "WhatsApp opt-in", example: true })
  @IsOptional()
  whatsappOptIn?: boolean;

  @ApiPropertyOptional({ description: "Email opt-in", example: true })
  @IsOptional()
  emailOptIn?: boolean;

  @ApiPropertyOptional({ description: "SMS opt-in", example: true })
  @IsOptional()
  smsOptIn?: boolean;

  @ApiPropertyOptional({ description: "Preferred report language (ENGLISH, HINDI, etc.)" })
  @IsOptional()
  @IsString()
  reportLanguage?: string;
}

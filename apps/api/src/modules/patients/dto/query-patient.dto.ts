import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Gender } from "./create-patient.dto";

export class QueryPatientDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: "Search by name, MRN, phone or email" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === "true" || value === true)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: "Filter: all | duplicates | inactive", default: "all" })
  @IsOptional()
  @IsString()
  status?: string;
}

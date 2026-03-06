import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, Min, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { InvoiceStatus } from "@delvion/types";

export class InvoiceQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus }) @IsEnum(InvoiceStatus) @IsOptional() status?: InvoiceStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() patientId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dateFrom?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dateTo?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() @Transform(({ value }) => value === "true" || value === true) overdue?: boolean;
  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() @Type(() => Number) page?: number;
  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional() @Type(() => Number) limit?: number;
}

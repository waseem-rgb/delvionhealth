import { IsNumber, IsOptional, Min, IsDateString, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class UpdateInvoiceDto {
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Type(() => Number) discountAmount?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Type(() => Number) taxAmount?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

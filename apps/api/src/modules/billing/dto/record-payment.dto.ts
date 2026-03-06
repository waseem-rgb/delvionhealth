import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PaymentMethod } from "@delvion/types";

export class RecordPaymentDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId: string = "";
  @ApiProperty() @IsNumber() @Min(0.01) @Type(() => Number) amount: number = 0;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod = PaymentMethod.CASH;
  @ApiPropertyOptional() @IsString() @IsOptional() reference?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() paidAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DiscountType } from "./create-order.dto";

export class ApplyDiscountDto {
  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ description: "Discount value: amount in INR (FLAT) or % (PERCENT)" })
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ description: "Reason for the discount" })
  @IsOptional()
  @IsString()
  reason?: string;
}

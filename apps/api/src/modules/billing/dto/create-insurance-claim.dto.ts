import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class CreateInsuranceClaimDto {
  @ApiProperty() @IsString() @IsNotEmpty() invoiceId: string = "";
  @ApiProperty() @IsString() @IsNotEmpty() insurerName: string = "";
  @ApiProperty() @IsString() @IsNotEmpty() memberId: string = "";
  @ApiProperty() @IsNumber() @Min(0) @Type(() => Number) claimAmount: number = 0;
  @ApiPropertyOptional() @IsString() @IsOptional() claimNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

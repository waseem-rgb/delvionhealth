import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ClaimStatus } from "@delvion/types";

export class UpdateClaimStatusDto {
  @ApiProperty({ enum: ClaimStatus }) @IsEnum(ClaimStatus) @IsNotEmpty() status: ClaimStatus = ClaimStatus.SUBMITTED;
  @ApiPropertyOptional() @IsNumber() @Min(0) @IsOptional() @Type(() => Number) approvedAmount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() rejectionReason?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

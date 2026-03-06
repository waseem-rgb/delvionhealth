import { IsOptional, IsString, IsBoolean, IsInt, Min } from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryResultDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() patientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() interpretation?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Transform(({ value }) => value === "true" || value === true) isDraft?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Transform(({ value }) => value === "true" || value === true) isVerified?: boolean;
}

import { IsString, IsOptional, IsNumber, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateResultDto {
  @ApiProperty() @IsString() orderItemId!: string;
  @ApiProperty() @IsString() sampleId!: string;
  @ApiProperty() @IsString() value!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) numericValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDraft?: boolean;
}

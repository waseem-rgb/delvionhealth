import { IsString, IsOptional, IsDateString, IsNumber } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class LogVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsLng?: number;
}

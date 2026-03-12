import { IsOptional, IsString, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class QueryOrderDto {
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

  @ApiPropertyOptional({ description: "Search by order number or patient name/MRN" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Alias for search" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: "Single or comma-separated OrderStatus values" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "Order priority" })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ description: "Collection type" })
  @IsOptional()
  @IsString()
  collectionType?: string;

  @ApiPropertyOptional({ description: "ISO date string — start of range" })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO date string — end of range" })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Report delivery mode filter: AUTO, MANUAL, DOWNLOAD" })
  @IsOptional()
  @IsString()
  reportDeliveryMode?: string;

  @ApiPropertyOptional({ description: "Filter by delivered date (ISO date string)" })
  @IsOptional()
  @IsString()
  deliveredDate?: string;
}

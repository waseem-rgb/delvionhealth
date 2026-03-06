import { IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AccessionSampleDto {
  @ApiProperty() @IsString() orderId!: string;
  @ApiProperty({ description: "Barcode scanned/typed from the physical tube" })
  @IsString()
  barcodeId!: string;
  @ApiProperty() @IsString() type!: string;
  @ApiProperty() @IsString() branchId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSampleStatusDto {
  @ApiProperty() @IsString() status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class MoveSampleDto {
  @ApiProperty() @IsString() toLocation!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fromLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class RejectSampleDto {
  @ApiProperty() @IsString() reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTenantDto {
  @ApiProperty({ example: "Acme Diagnostics" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "acme-diagnostics" })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug!: string;

  @ApiPropertyOptional({ example: "starter" })
  @IsOptional()
  @IsString()
  plan?: string;
}

export class CreateBranchDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

export class UpdateTenantConfigDto {
  @ApiPropertyOptional() @IsOptional() config!: Record<string, unknown>;
}

export class UpdateTenantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;
}

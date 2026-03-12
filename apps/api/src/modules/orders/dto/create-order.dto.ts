import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
  IsInt,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum OrderPriority {
  ROUTINE = "ROUTINE",
  URGENT = "URGENT",
  STAT = "STAT",
}

export enum CollectionType {
  WALK_IN = "WALK_IN",
  HOME_COLLECTION = "HOME_COLLECTION",
  EXTERNAL_LAB = "EXTERNAL_LAB",
}

export enum DiscountType {
  NONE = "NONE",
  FLAT = "FLAT",
  PERCENT = "PERCENT",
}

export class OrderItemDto {
  @ApiProperty() @IsString() testCatalogId!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: "Item-level discount %", default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsString() patientId!: string;
  @ApiProperty() @IsString() branchId!: string;

  @ApiPropertyOptional({ enum: OrderPriority, default: OrderPriority.ROUTINE })
  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;

  @ApiPropertyOptional({ enum: CollectionType, default: CollectionType.WALK_IN })
  @IsOptional()
  @IsEnum(CollectionType)
  collectionType?: CollectionType;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ description: "Order-level flat discount (INR)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ enum: DiscountType, default: DiscountType.NONE })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: "Referring doctor (User ID)" })
  @IsOptional()
  @IsString()
  referringDoctorId?: string;

  @ApiPropertyOptional({ description: "Organisation ID for B2B orders" })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: "Rate list ID for custom pricing" })
  @IsOptional()
  @IsString()
  rateListId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCreditOrder?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amountReceived?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentRemark?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentRefNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentScreenshotUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentScreenshotKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() insuranceTpaName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() insurancePolicyNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reportLanguage?: string;
}

import { IsString, IsNotEmpty, IsNumber, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class IssueRefundDto {
  @ApiProperty() @IsString() @IsNotEmpty() paymentId: string = "";
  @ApiProperty() @IsNumber() @Min(0.01) @Type(() => Number) amount: number = 0;
  @ApiProperty() @IsString() @IsNotEmpty() reason: string = "";
}

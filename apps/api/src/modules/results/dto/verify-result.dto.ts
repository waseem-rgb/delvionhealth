import { IsArray, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyResultDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

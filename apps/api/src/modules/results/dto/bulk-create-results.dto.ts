import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CreateResultDto } from "./create-result.dto";

export class BulkCreateResultsDto {
  @ApiProperty({ type: [CreateResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateResultDto)
  results!: CreateResultDto[];
}

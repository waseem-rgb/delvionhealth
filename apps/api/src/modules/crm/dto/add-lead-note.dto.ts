import { IsString, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NoteType } from "@delvion/types";

export class AddLeadNoteDto {
  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ enum: NoteType })
  @IsOptional()
  @IsEnum(NoteType)
  type?: NoteType;
}

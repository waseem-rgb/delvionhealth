import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "admin@delvion.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Admin@123" })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: "OldPassword@123" })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: "NewPassword@456" })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@delvion.com" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Token received via email" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "NewPassword@456", minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegistroInicialDto {
  @IsString() @MinLength(3) nombreCompleto: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

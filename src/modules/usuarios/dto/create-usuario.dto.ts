import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Rol } from '../../../common/enums/roles.enum';

export class CreateUsuarioDto {
  @IsString() nombreCompleto: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(Rol) rol: Rol;
}

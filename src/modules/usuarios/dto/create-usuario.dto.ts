import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { Rol } from '../../../common/enums/roles.enum';
import { PATRON_PASSWORD_SEGURA } from '../../../common/utils/password-policy.util';

export class CreateUsuarioDto {
  @IsString() nombreCompleto: string;
  @IsEmail() email: string;
  @IsString()
  @MinLength(8)
  @Matches(PATRON_PASSWORD_SEGURA, { message: 'La contraseña debe incluir una mayúscula y un dígito.' })
  password: string;
  @IsEnum(Rol) rol: Rol;
}

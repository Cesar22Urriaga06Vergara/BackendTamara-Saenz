import { IsString, Matches, MinLength } from 'class-validator';
import { PATRON_PASSWORD_SEGURA } from '../../../common/utils/password-policy.util';

export class CambiarPasswordDto {
  @IsString()
  @MinLength(8)
  @Matches(PATRON_PASSWORD_SEGURA, { message: 'La contraseña debe incluir una mayúscula y un dígito.' })
  nuevaPassword: string;
}

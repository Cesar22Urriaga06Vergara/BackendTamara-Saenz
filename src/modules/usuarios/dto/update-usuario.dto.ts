import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Rol } from '../../../common/enums/roles.enum';

export class UpdateUsuarioDto {
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsEnum(Rol) rol?: Rol;
  @IsOptional() @IsBoolean() activo?: boolean;
}

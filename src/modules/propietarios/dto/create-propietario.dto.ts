import { IsOptional, IsString } from 'class-validator';

/** `esInmobiliaria` NUNCA se expone aquí: solo la migración semilla puede crear ese registro especial. */
export class CreatePropietarioDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() numeroDocumento?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() email?: string;
}

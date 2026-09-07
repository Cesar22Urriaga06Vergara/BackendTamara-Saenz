import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/** El frontend siempre manda los campos opcionales, con `''` cuando están vacíos. `@IsOptional`
 * de class-validator solo ignora `null`/`undefined`, así que sin esto un `email: ''` hacía
 * fallar `@IsEmail` y rechazaba toda la petición (D2: "crear cliente sin correo → 400"). */
const vacioAUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  return limpio === '' ? undefined : limpio;
};

/** DTO compartido por Cliente y Codeudor (mismos atributos de directorio). */
export class CreatePersonaDto {
  @IsString() numeroDocumento: string;
  @Transform(vacioAUndefined) @IsOptional() @IsString() tipoDocumento?: string;
  @IsString() nombreCompleto: string;
  @Transform(vacioAUndefined) @IsOptional() @IsEmail() email?: string;
  @Transform(vacioAUndefined) @IsOptional() @IsString() telefono?: string;
  @Transform(vacioAUndefined) @IsOptional() @IsString() direccion?: string;
}

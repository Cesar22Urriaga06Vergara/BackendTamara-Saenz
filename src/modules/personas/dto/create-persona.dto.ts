import { IsEmail, IsOptional, IsString } from 'class-validator';

/** DTO compartido por Cliente y Codeudor (mismos atributos de directorio). */
export class CreatePersonaDto {
  @IsString() numeroDocumento: string;
  @IsOptional() @IsString() tipoDocumento?: string;
  @IsString() nombreCompleto: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
}

import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EstadoInmueble } from '../entities/inmueble.entity';

export class CreateInmuebleDto {
  /** Si se omite, el inmueble queda asociado al propietario especial "INMOBILIARIA" (§4). */
  @IsOptional() @IsUUID() propietarioId?: string;

  @IsString() direccion: string;
  @IsString() barrio: string;

  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(0) canonValor: number;
  @IsOptional() @IsInt() @Min(0) depositoValor?: number;

  @IsOptional() @IsString() codigoEnergia?: string;
  @IsOptional() @IsString() codigoAgua?: string;
  @IsOptional() @IsString() codigoGas?: string;

  @IsOptional() @IsEnum(EstadoInmueble) estado?: EstadoInmueble;
  @IsOptional() @IsString() observaciones?: string;
}

import { IsNotEmpty, IsString } from 'class-validator';

/** Reactivación TERMINADO → ACTIVO (§6.6): motivo obligatorio, exclusivo Administrador. */
export class ReactivarContratoDto {
  @IsString() @IsNotEmpty() motivo: string;
}

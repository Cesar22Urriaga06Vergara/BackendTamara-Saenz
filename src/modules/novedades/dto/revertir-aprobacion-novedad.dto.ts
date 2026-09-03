import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Revierte una aprobación financiera mal hecha de una novedad — EXCLUSIVO Administrador. */
export class RevertirAprobacionNovedadDto {
  @IsString() @IsNotEmpty() @MaxLength(300) motivo: string;
}

import { IsOptional, IsString } from 'class-validator';

/** Campos de paginación compartidos por los filtros de listado (page/limit como string, coeridos por el servicio). */
export class PaginacionDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

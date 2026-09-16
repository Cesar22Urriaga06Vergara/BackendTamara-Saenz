import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TipoServicioPublico } from '../entities/recibo-publico.entity';

export class CreateServicioPublicoDto {
  @IsUUID()
  inmuebleId: string;

  @IsEnum(TipoServicioPublico)
  tipoServicio: TipoServicioPublico;

  @IsString()
  periodo: string;

  @IsString()
  numeroFactura: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  valor: number;

  @IsDateString()
  fechaEmision: string;

  @IsDateString()
  fechaVencimiento: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

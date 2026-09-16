import { IsEnum, IsOptional } from 'class-validator';
import { EstadoPagoServicio, ResponsablePago } from '../entities/recibo-publico.entity';

export class AprobarResponsableDto {
  @IsEnum(ResponsablePago)
  responsablePago: ResponsablePago;

  @IsOptional()
  @IsEnum(EstadoPagoServicio)
  estadoPago?: EstadoPagoServicio;
}

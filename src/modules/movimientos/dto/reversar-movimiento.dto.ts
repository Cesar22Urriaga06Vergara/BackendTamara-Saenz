import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReversarMovimientoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  motivo: string;
}

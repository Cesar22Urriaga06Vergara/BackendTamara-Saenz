import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConsecutivoConfigDto {
  @IsString()
  tipo: string;

  @IsOptional()
  @IsString()
  prefijo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ultimoNumero?: number;
}

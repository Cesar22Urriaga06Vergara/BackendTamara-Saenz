import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEmpresaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() slogan?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() telefono?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  horizonteMesesCanon?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoInicialCaja?: number;
}

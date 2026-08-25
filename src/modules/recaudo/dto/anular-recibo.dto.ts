import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularReciboDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  motivo: string;
}

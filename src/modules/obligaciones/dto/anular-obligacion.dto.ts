import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularObligacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  motivo: string;
}

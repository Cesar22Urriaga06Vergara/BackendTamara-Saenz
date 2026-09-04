import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInmuebleDto } from './create-inmueble.dto';

/**
 * B3: COP no maneja centavos — canonValor/depositoValor deben ser enteros, no decimales
 * (la validación anterior con @IsNumber aceptaba decimales que la columna decimal(12,2)
 * terminaba truncando en silencio).
 */
describe('CreateInmuebleDto — montos enteros', () => {
  const base = { direccion: 'Calle 1', barrio: 'Centro' };

  it('rechaza canonValor con decimales', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000.5 });
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'canonValor')).toBe(true);
  });

  it('acepta canonValor entero', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza depositoValor con decimales', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000, depositoValor: 500000.99 });
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'depositoValor')).toBe(true);
  });

  it('acepta depositoValor entero', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000, depositoValor: 1000000 });
    expect(await validate(dto)).toHaveLength(0);
  });
});

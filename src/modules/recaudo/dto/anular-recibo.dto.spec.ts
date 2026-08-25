import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnularReciboDto } from './anular-recibo.dto';

/**
 * Valida AUD-02: antes `motivo` solo exigía `@IsString()`, así que una cadena vacía pasaba la
 * validación del `ValidationPipe` global — a diferencia de `ReversarMovimientoDto`, que sí
 * exigía `@IsNotEmpty()`. Prueba de la clase DTO directamente (no de integración contra la
 * BD): lo que se corrigió es una regla de `class-validator`, evaluada por el `ValidationPipe`
 * antes de que la petición llegue al service — un test de servicio no la ejercitaría.
 */
describe('AnularReciboDto — AUD-02', () => {
  it('rechaza motivo vacío', async () => {
    const dto = plainToInstance(AnularReciboDto, { motivo: '' });
    const errores = await validate(dto);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.some((e) => e.property === 'motivo')).toBe(true);
  });

  it('rechaza motivo ausente', async () => {
    const dto = plainToInstance(AnularReciboDto, {});
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'motivo')).toBe(true);
  });

  it('acepta un motivo real', async () => {
    const dto = plainToInstance(AnularReciboDto, { motivo: 'Error de digitación' });
    const errores = await validate(dto);
    expect(errores).toHaveLength(0);
  });
});

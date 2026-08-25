import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnularObligacionDto } from './anular-obligacion.dto';

/** Valida AUD-02: `motivo` vacío ya no pasa la validación (ver anular-recibo.dto.spec.ts). */
describe('AnularObligacionDto — AUD-02', () => {
  it('rechaza motivo vacío', async () => {
    const dto = plainToInstance(AnularObligacionDto, { motivo: '' });
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'motivo')).toBe(true);
  });

  it('acepta un motivo real', async () => {
    const dto = plainToInstance(AnularObligacionDto, { motivo: 'Obligación generada por error' });
    const errores = await validate(dto);
    expect(errores).toHaveLength(0);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePersonaDto } from './create-persona.dto';

/**
 * D2: el frontend siempre manda los campos opcionales, con `''` cuando están vacíos.
 * `@IsOptional` de class-validator solo ignora `null`/`undefined`, así que sin el `@Transform`
 * un `email: ''` hacía fallar `@IsEmail` y devolvía 400 al crear un cliente/codeudor sin correo.
 */
describe('CreatePersonaDto (D2 — opcionales vacíos)', () => {
  const base = { numeroDocumento: '123', nombreCompleto: 'Ana Pérez' };

  async function validar(raw: Record<string, unknown>) {
    const dto = plainToInstance(CreatePersonaDto, raw);
    return { dto, errores: await validate(dto) };
  }

  it('acepta crear una persona sin correo (email: "")', async () => {
    const { dto, errores } = await validar({ ...base, email: '', telefono: '', direccion: '' });
    expect(errores).toHaveLength(0);
    expect(dto.email).toBeUndefined();
    expect(dto.telefono).toBeUndefined();
    expect(dto.direccion).toBeUndefined();
  });

  it('acepta crear una persona sin ningún campo opcional', async () => {
    const { errores } = await validar(base);
    expect(errores).toHaveLength(0);
  });

  it('sigue rechazando un correo con formato inválido', async () => {
    const { errores } = await validar({ ...base, email: 'no-es-un-correo' });
    expect(errores).toHaveLength(1);
    expect(errores[0].property).toBe('email');
  });

  it('acepta un correo válido', async () => {
    const { dto, errores } = await validar({ ...base, email: '  ana@correo.com  ' });
    expect(errores).toHaveLength(0);
    expect(dto.email).toBe('ana@correo.com');
  });
});

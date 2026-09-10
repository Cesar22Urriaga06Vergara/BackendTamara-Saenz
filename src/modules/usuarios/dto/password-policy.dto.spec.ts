import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CambiarPasswordDto } from './cambiar-password.dto';
import { CreateUsuarioDto } from './create-usuario.dto';
import { validarPasswordSegura } from '../../../common/utils/password-policy.util';

async function validarPassword(dto: object, campo: string, password: string) {
  const datosBase =
    dto instanceof CreateUsuarioDto ? { nombreCompleto: 'Usuario', email: 'u@t.co', rol: 'RECEPCIONISTA' } : {};
  const instancia = plainToInstance(dto.constructor as new () => object, { ...datosBase, [campo]: password });
  return validate(instancia);
}

describe('política de contraseñas de usuarios', () => {
  it.each([
    [CreateUsuarioDto, 'password'],
    [CambiarPasswordDto, 'nuevaPassword'],
  ])('acepta una contraseña con mayúscula y dígito (%s)', async (Dto, campo) => {
    await expect(validarPassword(new Dto(), campo, 'Password123')).resolves.toHaveLength(0);
  });

  it.each([
    ['password123', 'sin mayúscula'],
    ['PasswordOnly', 'sin dígito'],
    ['Pass1', 'demasiado corta'],
  ])('rechaza una contraseña %s', async (password) => {
    const errores = await validarPassword(new CreateUsuarioDto(), 'password', password);
    expect(errores.length).toBeGreaterThan(0);
  });

  it('aplica la misma regla a las contraseñas del seed', () => {
    expect(validarPasswordSegura('Password123', 'SEED_ADMIN_PASSWORD')).toBe('Password123');
    expect(() => validarPasswordSegura('password123', 'SEED_ADMIN_PASSWORD')).toThrow(/mayúscula/);
  });
});

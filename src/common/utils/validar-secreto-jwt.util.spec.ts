import { validarSecretoJwt } from './validar-secreto-jwt.util';

/**
 * Unit test puro (sin Nest ni BD) de la guardia de arranque del hallazgo S-1. Cubre los casos
 * del Plan de pruebas de `plans/013`: secreto ausente/corto lanza, placeholder de ejemplo lanza,
 * secreto aleatorio de 64 hex no lanza.
 */
describe('validarSecretoJwt', () => {
  const secreto64Hex = '4320c3b673139f780d34e2a04b459256419b2b30400a3997860f7221f71a8ed3';

  it('lanza si el secreto está ausente', () => {
    expect(() => validarSecretoJwt(undefined)).toThrow(/al menos 32/);
    expect(() => validarSecretoJwt('')).toThrow(/al menos 32/);
  });

  it('lanza si el secreto tiene menos de 32 caracteres', () => {
    expect(() => validarSecretoJwt('a'.repeat(31))).toThrow(/al menos 32/);
  });

  it('lanza con los placeholders de ejemplo, sea cual sea su longitud', () => {
    expect(() => validarSecretoJwt('change_this_access_secret')).toThrow(); // 25 chars: falla por corto
    expect(() => validarSecretoJwt('REEMPLAZAR_con_openssl_rand_hex_32')).toThrow(/ejemplo/); // 33 chars: falla por marcador
    expect(() => validarSecretoJwt('test_secret')).toThrow();
  });

  it('lanza si un secreto largo (>=32) contiene un marcador de ejemplo', () => {
    expect(() => validarSecretoJwt('changeme_' + 'x'.repeat(40))).toThrow(/ejemplo/);
    expect(() => validarSecretoJwt('x'.repeat(40) + '_PLACEHOLDER')).toThrow(/ejemplo/);
    expect(() => validarSecretoJwt('change_this_' + 'a'.repeat(30))).toThrow(/ejemplo/);
  });

  it('no lanza con un secreto aleatorio de 64 hex', () => {
    expect(() => validarSecretoJwt(secreto64Hex)).not.toThrow();
  });

  it('no lanza con exactamente 32 caracteres sin marcadores', () => {
    expect(() => validarSecretoJwt('a1b2c3d4e5f60718293a4b5c6d7e8f90')).not.toThrow();
  });
});

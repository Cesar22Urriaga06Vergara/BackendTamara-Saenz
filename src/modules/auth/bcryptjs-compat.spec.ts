import * as bcrypt from 'bcryptjs';

/**
 * BE-014 migró `bcrypt` (binario nativo, arrastraba `tar` con CVE crítica) a `bcryptjs`
 * (JS puro). Este spec deja evidencia de que la migración NO invalida las contraseñas ya
 * guardadas: los hashes `$2a$`/`$2b$` que produjo el `bcrypt` nativo siguen validando con
 * `bcryptjs.compare`, así que no hace falta ningún rehash masivo.
 */
describe('bcryptjs — compatibilidad hacia atrás con hashes existentes', () => {
  // Hash `$2b$` de 'Password#123' (cost 10) — formato idéntico al que guardó el bcrypt nativo.
  const hashExistente = '$2b$10$Vmz/VRicOkgFZoke/aBHOekho2AaDwpcnwclFP2jsha2dhO0TKxIi';

  it('valida un hash $2b$ ya almacenado', async () => {
    expect(await bcrypt.compare('Password#123', hashExistente)).toBe(true);
    expect(await bcrypt.compare('clave-incorrecta', hashExistente)).toBe(false);
  });

  it('valida también el formato histórico $2a$', async () => {
    const hash2a = bcrypt.hashSync('otra-clave', bcrypt.genSaltSync(10).replace('$2b$', '$2a$'));
    expect(hash2a.startsWith('$2a$')).toBe(true);
    expect(await bcrypt.compare('otra-clave', hash2a)).toBe(true);
  });

  it('hash + compare de una contraseña nueva hace round-trip', async () => {
    const hash = await bcrypt.hash('nueva-contraseña-2026', 10);
    expect(hash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('nueva-contraseña-2026', hash)).toBe(true);
  });
});

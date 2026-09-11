import { validarConfiguracionProduccion } from './validar-configuracion-produccion.util';

const configuracionValida = {
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://app.tamarasaenz.com',
  DB_HOST: 'mysql.railway.internal',
  DB_PORT: '3306',
  DB_USERNAME: 'tamara',
  DB_PASSWORD: 'secreto-real',
  DB_DATABASE: 'tamara_saenz',
  DB_SYNCHRONIZE: 'false',
  UPLOADS_DIR: '/data/uploads',
  SWAGGER_ENABLED: 'false',
};

describe('validarConfiguracionProduccion', () => {
  it('acepta una configuración de producción completa', () => {
    expect(() => validarConfiguracionProduccion(configuracionValida)).not.toThrow();
  });

  it('no aplica restricciones cuando no es producción', () => {
    expect(() => validarConfiguracionProduccion({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => validarConfiguracionProduccion({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('acepta synchronización automática cuando se habilita explícitamente', () => {
    expect(() => validarConfiguracionProduccion({ ...configuracionValida, DB_SYNCHRONIZE: 'true' })).not.toThrow();
  });

  it.each([
    ['CORS_ORIGIN', { CORS_ORIGIN: 'http://localhost:3011' }],
    ['DB_SYNCHRONIZE', { DB_SYNCHRONIZE: 'yes' }],
    ['UPLOADS_DIR', { UPLOADS_DIR: '' }],
    ['SWAGGER_ENABLED', { SWAGGER_ENABLED: 'true' }],
  ])('rechaza una configuración insegura en %s', (_campo, cambio) => {
    expect(() => validarConfiguracionProduccion({ ...configuracionValida, ...cambio })).toThrow();
  });

  it('rechaza una credencial de base de datos ausente', () => {
    const configuracion: Record<string, string> = { ...configuracionValida };
    delete configuracion.DB_PASSWORD;

    expect(() => validarConfiguracionProduccion(configuracion)).toThrow(/DB_PASSWORD/);
  });
});

import { isAbsolute } from 'path';

type Configuracion = Record<string, string | undefined>;

const VARIABLES_BD_OBLIGATORIAS = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];

function exigirVariable(configuracion: Configuracion, nombre: string): string {
  const valor = configuracion[nombre]?.trim();
  if (!valor) {
    throw new Error(`Configuración de producción incompleta: falta ${nombre}.`);
  }
  return valor;
}

function validarOrigenCors(origen: string): void {
  let url: URL;
  try {
    url = new URL(origen);
  } catch {
    throw new Error('Configuración de producción insegura: CORS_ORIGIN debe ser una URL válida.');
  }

  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Configuración de producción insegura: CORS_ORIGIN debe ser un origen HTTPS exacto.');
  }
}

/** Falla durante el arranque si una variable crítica de producción quedó sin cablear. */
export function validarConfiguracionProduccion(configuracion: Configuracion): void {
  if (configuracion.NODE_ENV !== 'production') return;

  const corsOrigin = exigirVariable(configuracion, 'CORS_ORIGIN');
  validarOrigenCors(corsOrigin);

  for (const variable of VARIABLES_BD_OBLIGATORIAS) exigirVariable(configuracion, variable);

  const puertoBd = Number(exigirVariable(configuracion, 'DB_PORT'));
  if (!Number.isInteger(puertoBd) || puertoBd < 1 || puertoBd > 65535) {
    throw new Error('Configuración de producción insegura: DB_PORT debe ser un puerto válido.');
  }

  if (configuracion.DB_SYNCHRONIZE?.trim().toLowerCase() !== 'false') {
    throw new Error('Configuración de producción insegura: DB_SYNCHRONIZE debe ser false.');
  }

  const uploadsDir = exigirVariable(configuracion, 'UPLOADS_DIR');
  if (!isAbsolute(uploadsDir)) {
    throw new Error('Configuración de producción insegura: UPLOADS_DIR debe ser una ruta absoluta.');
  }

  if (configuracion.SWAGGER_ENABLED?.trim().toLowerCase() === 'true') {
    throw new Error('Configuración de producción insegura: SWAGGER_ENABLED debe estar desactivado.');
  }
}

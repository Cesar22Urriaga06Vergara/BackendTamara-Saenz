import { join } from 'path';

/**
 * Raíz del almacenamiento de archivos subidos (hoy solo el logo de empresa).
 *
 * - En local: `<repo>/uploads`.
 * - En Railway: el filesystem del contenedor es **efímero** — se borra en cada deploy. Hay que
 *   montar un Volume y pasar su mountPath por `UPLOADS_DIR` (p. ej. `/data/uploads`). Sin eso, el
 *   logo desaparece de la UI y de todos los PDF de recibo/novedad tras el primer redeploy.
 *
 * Se lee de `process.env` (no de `ConfigService`) porque esta función la usan sitios que no están
 * en el árbol de DI de Nest: el `diskStorage` de Multer (decorador a nivel de clase) y los seeds.
 */
export function directorioUploads(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
}

/** Subcarpeta donde Multer escribe los logos de empresa. */
export function directorioLogos(): string {
  return join(directorioUploads(), 'empresa');
}

/** Prefijo público bajo el que `main.ts` sirve `directorioUploads()` como estático. */
export const PREFIJO_PUBLICO_UPLOADS = '/uploads/';
export const PREFIJO_PUBLICO_LOGO = '/uploads/empresa/';

/**
 * Resuelve una URL pública guardada en BD (`empresa.logoUrl` = `"/uploads/empresa/<archivo>"`) a
 * su ruta física en disco, respetando `UPLOADS_DIR`. Antes se hacía `join(process.cwd(), logoUrl)`,
 * que ignora el Volume.
 */
export function rutaFisicaDesdeUrlPublica(urlPublica: string): string {
  return join(directorioUploads(), urlPublica.replace(/^\/uploads\//, ''));
}

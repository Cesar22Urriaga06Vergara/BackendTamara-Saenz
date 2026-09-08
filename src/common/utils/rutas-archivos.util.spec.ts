import { join } from 'path';
import {
  directorioUploads,
  directorioLogos,
  rutaFisicaDesdeUrlPublica,
  PREFIJO_PUBLICO_LOGO,
} from './rutas-archivos.util';

/**
 * BE-017: el logo de empresa se guarda en disco. En Railway el FS es efímero, así que la raíz
 * de uploads se parametriza con `UPLOADS_DIR` (mountPath de un Volume). Este spec fija que la
 * resolución de rutas respeta esa variable y cae al default `<repo>/uploads` sin ella.
 */
describe('rutas-archivos.util', () => {
  const original = process.env.UPLOADS_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = original;
  });

  it('directorioUploads() sin UPLOADS_DIR → <cwd>/uploads', () => {
    delete process.env.UPLOADS_DIR;
    expect(directorioUploads()).toBe(join(process.cwd(), 'uploads'));
  });

  it('directorioUploads() con UPLOADS_DIR → ese valor', () => {
    process.env.UPLOADS_DIR = join('/data', 'uploads');
    expect(directorioUploads()).toBe(join('/data', 'uploads'));
  });

  it('directorioLogos() = directorioUploads()/empresa', () => {
    process.env.UPLOADS_DIR = join('/data', 'uploads');
    expect(directorioLogos()).toBe(join('/data', 'uploads', 'empresa'));
  });

  it('rutaFisicaDesdeUrlPublica() resuelve la URL pública contra UPLOADS_DIR', () => {
    process.env.UPLOADS_DIR = join('/data', 'uploads');
    const url = `${PREFIJO_PUBLICO_LOGO}abc-123.png`; // "/uploads/empresa/abc-123.png"
    expect(rutaFisicaDesdeUrlPublica(url)).toBe(join('/data', 'uploads', 'empresa', 'abc-123.png'));
  });

  it('rutaFisicaDesdeUrlPublica() sin UPLOADS_DIR usa <cwd>/uploads', () => {
    delete process.env.UPLOADS_DIR;
    expect(rutaFisicaDesdeUrlPublica('/uploads/empresa/x.png')).toBe(
      join(process.cwd(), 'uploads', 'empresa', 'x.png'),
    );
  });
});

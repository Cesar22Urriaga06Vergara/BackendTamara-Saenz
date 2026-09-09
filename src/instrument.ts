import * as Sentry from '@sentry/nestjs';

// Sentry debe inicializarse ANTES de importar cualquier otro módulo de la app, para poder
// instrumentarlos (por eso este archivo es el PRIMER import de `main.ts`). Sin `SENTRY_DSN`
// no hace absolutamente nada: seguro en local, en test y en cualquier entorno sin configurar.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Muestreo de trazas de performance: bajo por defecto (el free tier de Sentry tiene cuota).
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // No enviar PII (IP, cabeceras, cookies). La traza de auditoría (`AuditInterceptor`) ya
    // registra quién hizo qué; Sentry es solo para el stack trace del fallo.
    sendDefaultPii: false,
  });
}

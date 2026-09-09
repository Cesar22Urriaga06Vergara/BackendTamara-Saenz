import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AUDIT_ACTION_KEY, AuditActionMeta } from '../decorators/audit-action.decorator';
import { AuditoriaService } from '../../modules/auditoria/auditoria.service';

/**
 * Interceptor global de auditoría.
 * Cuando un handler está decorado con @AuditAction(), persiste el registro
 * de trazabilidad (quién, qué, cuándo, sobre qué ruta) vía AuditoriaService.
 * No bloquea la respuesta al usuario si el registro de auditoría falla (best-effort).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => AuditoriaService)) private readonly auditoriaService: AuditoriaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.getAllAndOverride<AuditActionMeta>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    // Para endpoints públicos (ej. login) todavía no hay `req.user`: se usa el email
    // del body como mejor esfuerzo, para poder auditar también los intentos fallidos
    // de inicio de sesión (AUD-020).
    const usuario = req.user?.email ?? req.body?.email ?? 'ANONIMO';
    const inicio = Date.now();

    const registrar = (accion: string) => {
      const duracionMs = Date.now() - inicio;
      this.auditoriaService
        .registrar({
          modulo: meta.modulo,
          accion,
          usuarioEmail: usuario,
          metodoHttp: req.method,
          ruta: req.originalUrl,
          duracionMs,
          ipOrigen: req.ip,
        })
        .catch((err) => {
          this.logger.error({ err }, 'Error al persistir el registro de auditoría');
        });
    };

    return next.handle().pipe(
      tap(() => registrar(meta.accion)),
      catchError((err) => {
        registrar(`${meta.accion}_FALLIDO`);
        return throwError(() => err);
      }),
    );
  }
}

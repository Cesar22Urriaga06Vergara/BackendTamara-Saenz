import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

export interface AuditActionMeta {
  modulo: string;
  accion: string;
}

/**
 * Decorador de trazabilidad. Uso: @AuditAction({ modulo: 'RECAUDO', accion: 'REGISTRAR_PAGO' })
 * El AuditInterceptor global lee este metadato y persiste el registro en auditoria.
 */
export const AuditAction = (meta: AuditActionMeta) => SetMetadata(AUDIT_ACTION_KEY, meta);

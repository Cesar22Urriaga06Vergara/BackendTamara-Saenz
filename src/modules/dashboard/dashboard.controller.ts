import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';

@ApiTags('General / Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** Métricas operativas — cualquier rol autenticado. Nunca incluye cifras de dinero. */
  @Get()
  resumen() {
    return this.service.metricasOperativas();
  }

  /**
   * Cifras financieras (cartera, recaudo del mes) — EXCLUSIVO Administrador.
   * Endpoint separado (en vez de un `if` dentro de `resumen()`) para que la restricción
   * viva en `@Roles` + `RolesGuard`, el mismo mecanismo declarativo que protege el resto
   * del sistema: si algún día se borra este decorador por error, el guard global deniega
   * por defecto (fail-closed) en vez de filtrar dinero silenciosamente.
   */
  @Get('financiero')
  @Roles(Rol.ADMINISTRADOR)
  resumenFinanciero() {
    return this.service.metricasFinancieras();
  }
}

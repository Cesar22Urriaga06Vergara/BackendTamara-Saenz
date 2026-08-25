import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ObligacionesService } from './obligaciones.service';

/** Job diario que garantiza el horizonte de canones futuros generados (idempotente). */
@Injectable()
export class ObligacionesCron {
  private readonly logger = new Logger(ObligacionesCron.name);

  constructor(private readonly service: ObligacionesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async ejecutar() {
    const resultado = await this.service.generarCanonesMensuales();
    this.logger.log(`Generación automática de canones: ${resultado.generadas} obligaciones creadas.`);
  }
}

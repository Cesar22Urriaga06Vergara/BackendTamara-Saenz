import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { LessThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * S-10: la tabla `refresh_token` solo crece — cada login añade una fila y cada refresh
 * (rotación) revoca la anterior sin borrarla. Sin limpieza, en meses son cientos de miles de
 * filas muertas. Este cron la poda a diario:
 *
 * - **Expirados**: `expiraEn` en el pasado → ya no sirven para nada, se borran.
 * - **Revocados con > 7 días**: se conservan una semana como ventana para una futura detección
 *   de reuso de refresh token (un token revocado que se vuelve a presentar = posible robo);
 *   pasada esa ventana, se borran.
 */
@Injectable()
export class RefreshTokenCron {
  constructor(
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RefreshTokenCron.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async limpiar(): Promise<void> {
    const borrados = await this.podar();
    if (borrados > 0) {
      this.logger.info({ borrados }, 'refresh_token: filas muertas eliminadas');
    }
  }

  /** Devuelve cuántas filas borró. Extraído para poder testearlo sin esperar al cron. */
  async podar(referencia: Date = new Date()): Promise<number> {
    const hace7Dias = new Date(referencia.getTime() - 7 * 24 * 60 * 60 * 1000);

    const expirados = await this.refreshRepo.delete({ expiraEn: LessThan(referencia) });
    const revocadosViejos = await this.refreshRepo.delete({ revocado: true, creadoEn: LessThan(hace7Dias) });

    return (expirados.affected ?? 0) + (revocadosViejos.affected ?? 0);
  }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

/** Timeout del ping a la BD: si la conexión está colgada, el healthcheck no debe colgarse con ella. */
const TIMEOUT_PING_MS = 3000;

interface EstadoIndicador {
  status: 'up' | 'down';
  message?: string;
}

/**
 * Healthcheck sin autenticación para el proveedor de hosting (Railway) y el monitor de uptime
 * externo: confirma que la app arrancó y que la base de datos responde.
 *
 * - `@Public()` es obligatorio: sin él, `JwtAuthGuard` (guard global) devolvería 401 y Railway
 *   marcaría el deploy como no sano.
 * - Responde 200 con `{ status: 'ok', ... }` si la BD contesta; 503 con `{ status: 'error', ... }`
 *   si no. La forma del cuerpo imita la de `@nestjs/terminus` (`info` / `error` / `details`) por
 *   si algún monitor la parsea, pero sin la dependencia (terminus 12 es ESM y rompe la suite Jest).
 * - No expone versión, hostname ni ningún dato interno — es un endpoint abierto.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    const database = await this.pingBaseDeDatos();
    const cuerpo = {
      status: database.status === 'up' ? 'ok' : 'error',
      info: database.status === 'up' ? { database } : {},
      error: database.status === 'up' ? {} : { database },
      details: { database },
    };

    if (database.status === 'down') {
      throw new ServiceUnavailableException(cuerpo);
    }
    return cuerpo;
  }

  private async pingBaseDeDatos(): Promise<EstadoIndicador> {
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`ping a la BD superó ${TIMEOUT_PING_MS} ms`)), TIMEOUT_PING_MS),
        ),
      ]);
      return { status: 'up' };
    } catch (err) {
      return { status: 'down', message: err instanceof Error ? err.message : 'error desconocido' };
    }
  }
}

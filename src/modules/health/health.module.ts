import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Solo expone `GET /health`. El `DataSource` por defecto lo provee `TypeOrmModule.forRootAsync`
 * en `AppModule` y es inyectable app-wide, así que este módulo no importa nada.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

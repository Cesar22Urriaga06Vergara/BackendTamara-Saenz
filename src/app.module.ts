import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

import { AuthModule } from './modules/auth/auth.module';
import { EmpresaModule } from './modules/empresa/empresa.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { PersonasModule } from './modules/personas/personas.module';
import { InmueblesModule } from './modules/inmuebles/inmuebles.module';
import { PropietariosModule } from './modules/propietarios/propietarios.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { NovedadesModule } from './modules/novedades/novedades.module';
import { MovimientosModule } from './modules/movimientos/movimientos.module';
import { CajaModule } from './modules/caja/caja.module';
import { ObligacionesModule } from './modules/obligaciones/obligaciones.module';
import { RecaudoModule } from './modules/recaudo/recaudo.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { validarConfiguracionProduccion } from './common/utils/validar-configuracion-produccion.util';

/**
 * Nivel de log efectivo: `LOG_LEVEL` manda; si no, `test` → silencio (no ensuciar la salida de
 * la suite), `production` → `info`, resto → `debug`.
 */
function nivelDeLog(): string {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (process.env.NODE_ENV === 'test') return 'silent';
  if (process.env.NODE_ENV === 'production') return 'info';
  return 'debug';
}

@Module({
  imports: [
    // Primero: engancha Sentry al ciclo de vida de Nest. Sin SENTRY_DSN (ver instrument.ts) es
    // inerte. Debe ir antes que los demás módulos.
    SentryModule.forRoot(),
    // Logging estructurado (JSON a stdout, que Railway captura) + correlation ID por petición.
    LoggerModule.forRoot({
      pinoHttp: {
        level: nivelDeLog(),
        // Correlation ID: reutiliza el `x-request-id` entrante (si un proxy/futuro frontend lo
        // manda) o genera uno, y lo devuelve en la respuesta para poder cruzarlo con el cliente.
        genReqId: (req, res) => {
          const entrante = req.headers['x-request-id'];
          const id = (Array.isArray(entrante) ? entrante[0] : entrante) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // `pino-pretty` (worker thread) SOLO en desarrollo local. En prod y en test: JSON crudo.
        transport:
          process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        autoLogging: true,
        // Nunca loguear credenciales ni cuerpos.
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        validarConfiguracionProduccion(config);
        return config;
      },
    }),
    // Rate-limit GLOBAL por IP para toda la API (200 req/min). `/auth/login` lo baja a 5/min
    // (`@Throttle` en el controller) y `/health` lo salta (`@SkipThrottle`). Detrás de Railway
    // hay que fijar `TRUST_PROXY` para que la IP contada sea la del cliente, no la del proxy.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        // El servidor real es MySQL 8 (Railway). TypeORM genera SQL ligeramente distinto para
        // columnas GENERATED ALWAYS AS (...) según el dialecto — las migraciones ya están
        // escritas MySQL-8-compatible (CAST(... AS CHAR), no DATE_FORMAT; ver CONC-01). Verificado
        // 2026-09-08: las 25 migraciones + los 188 tests corren limpio contra MySQL 8.4.11 (BE-016).
        type: 'mysql',
        host: cfg.get('DB_HOST'),
        port: cfg.get<number>('DB_PORT'),
        username: cfg.get('DB_USERNAME'),
        password: cfg.get('DB_PASSWORD'),
        database: cfg.get('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: cfg.get('DB_SYNCHRONIZE') === 'true',
        logging: cfg.get('DB_LOGGING') === 'true',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        // Tamaño del pool de conexiones mysql2. Dimensiónalo según el plan de Railway
        // (máx. de conexiones del plugin MySQL). Por defecto 10 (el default de mysql2).
        extra: { connectionLimit: Number(cfg.get('DB_POOL_SIZE')) || 10 },
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmpresaModule,
    UsuariosModule,
    PersonasModule,
    InmueblesModule,
    PropietariosModule,
    ContratosModule,
    NovedadesModule,
    MovimientosModule,
    CajaModule,
    ObligacionesModule,
    RecaudoModule,
    DocumentosModule,
    AuditoriaModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    // Primero de todos los guards: corta el tráfico abusivo antes de gastar CPU en auth/DB.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Reporta a Sentry las excepciones NO controladas por ningún otro filtro (bugs reales:
    // TypeError, promesas colgadas, etc.). Nest evalúa los filtros globales en orden inverso al
    // de registro y `TypeOrmExceptionFilter` se registra después vía `app.useGlobalFilters()`
    // en main.ts, así que sigue atendiendo primero los `QueryFailedError` (traducción a 409/400/
    // 503). Los `HttpException` los trata Sentry como "esperados" y NO los reporta.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}

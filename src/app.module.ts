import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        synchronize: cfg.get('DB_SYNCHRONIZE') === 'true', // false en producción: usar migraciones
        logging: cfg.get('DB_LOGGING') === 'true',
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
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}

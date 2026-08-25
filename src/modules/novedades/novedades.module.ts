import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Novedad } from './entities/novedad.entity';
import { Inmueble } from '../inmuebles/entities/inmueble.entity';
import { Contrato } from '../contratos/entities/contrato.entity';
import { NovedadesService } from './novedades.service';
import { NovedadesController } from './novedades.controller';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { EmpresaModule } from '../empresa/empresa.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Novedad, Inmueble, Contrato]),
    ObligacionesModule,
    MovimientosModule,
    EmpresaModule,
  ],
  controllers: [NovedadesController],
  providers: [NovedadesService],
  exports: [NovedadesService],
})
export class NovedadesModule {}

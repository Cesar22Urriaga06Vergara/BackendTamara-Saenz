import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contrato } from '../contratos/entities/contrato.entity';
import { Obligacion } from '../obligaciones/entities/obligacion.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { ReciboCaja } from '../recaudo/entities/recibo-caja.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contrato, Obligacion, Novedad, ReciboCaja]), ObligacionesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

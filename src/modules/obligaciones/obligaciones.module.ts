import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Obligacion } from './entities/obligacion.entity';
import { Contrato } from '../contratos/entities/contrato.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { HistorialTasaMora } from '../empresa/entities/historial-tasa-mora.entity';
import { ObligacionesService } from './obligaciones.service';
import { ObligacionesController } from './obligaciones.controller';
import { ObligacionesCron } from './obligaciones.cron';

@Module({
  imports: [TypeOrmModule.forFeature([Obligacion, Contrato, Empresa, HistorialTasaMora])],
  controllers: [ObligacionesController],
  providers: [ObligacionesService, ObligacionesCron],
  exports: [ObligacionesService],
})
export class ObligacionesModule {}

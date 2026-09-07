import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movimiento } from './entities/movimiento.entity';
import { MovimientosService } from './movimientos.service';
import { MovimientosController } from './movimientos.controller';
import { EmpresaModule } from '../empresa/empresa.module';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([Movimiento]), EmpresaModule, ObligacionesModule],
  controllers: [MovimientosController],
  providers: [MovimientosService],
  exports: [MovimientosService],
})
export class MovimientosModule {}

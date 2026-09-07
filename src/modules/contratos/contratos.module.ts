import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contrato } from './entities/contrato.entity';
import { ContratoHistorialEstado } from './entities/contrato-historial-estado.entity';
import { Cliente } from '../personas/entities/cliente.entity';
import { Codeudor } from '../personas/entities/codeudor.entity';
import { Inmueble } from '../inmuebles/entities/inmueble.entity';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { ContratosService } from './contratos.service';
import { ContratosController } from './contratos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contrato, ContratoHistorialEstado, Cliente, Codeudor, Inmueble]),
    ObligacionesModule,
    MovimientosModule,
  ],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}

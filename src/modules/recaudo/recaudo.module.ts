import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReciboCaja } from './entities/recibo-caja.entity';
import { DetallePago } from './entities/detalle-pago.entity';
import { AplicacionPago } from './entities/aplicacion-pago.entity';
import { SaldoFavorCredito } from './entities/saldo-favor-credito.entity';
import { DescuentoDeposito } from './entities/descuento-deposito.entity';
import { Contrato } from '../contratos/entities/contrato.entity';
import { Obligacion } from '../obligaciones/entities/obligacion.entity';
import { RecaudoService } from './recaudo.service';
import { RecaudoController } from './recaudo.controller';
import { ObligacionesModule } from '../obligaciones/obligaciones.module';
import { EmpresaModule } from '../empresa/empresa.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReciboCaja, DetallePago, AplicacionPago, SaldoFavorCredito, DescuentoDeposito, Contrato, Obligacion]),
    ObligacionesModule,
    EmpresaModule,
    MovimientosModule,
  ],
  controllers: [RecaudoController],
  providers: [RecaudoService],
  exports: [RecaudoService],
})
export class RecaudoModule {}

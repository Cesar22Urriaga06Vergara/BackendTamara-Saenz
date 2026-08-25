import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArqueoCaja } from './entities/arqueo-caja.entity';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { EmpresaModule } from '../empresa/empresa.module';

@Module({
  imports: [TypeOrmModule.forFeature([ArqueoCaja]), MovimientosModule, EmpresaModule],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}

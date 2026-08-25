import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empresa } from './entities/empresa.entity';
import { Consecutivo } from './entities/consecutivo.entity';
import { HistorialTasaMora } from './entities/historial-tasa-mora.entity';
import { EmpresaService } from './empresa.service';
import { EmpresaController } from './empresa.controller';
import { ConsecutivoService } from './consecutivo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, Consecutivo, HistorialTasaMora])],
  controllers: [EmpresaController],
  providers: [EmpresaService, ConsecutivoService],
  exports: [ConsecutivoService, EmpresaService],
})
export class EmpresaModule {}

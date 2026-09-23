import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntrevistaArrendamiento } from './entities/entrevista-arrendamiento.entity';
import { EntrevistasArrendamientoController } from './entrevistas-arrendamiento.controller';
import { EntrevistasArrendamientoService } from './entrevistas-arrendamiento.service';
import { EmpresaModule } from '../empresa/empresa.module';

@Module({
  imports: [TypeOrmModule.forFeature([EntrevistaArrendamiento]), EmpresaModule],
  controllers: [EntrevistasArrendamientoController],
  providers: [EntrevistasArrendamientoService],
  exports: [EntrevistasArrendamientoService],
})
export class EntrevistasArrendamientoModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inmueble } from '../inmuebles/entities/inmueble.entity';
import { ServiciosPublicosController } from './servicios-publicos.controller';
import { ServiciosPublicosService } from './servicios-publicos.service';
import { ReciboPublico } from './entities/recibo-publico.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReciboPublico, Inmueble])],
  controllers: [ServiciosPublicosController],
  providers: [ServiciosPublicosService],
  exports: [ServiciosPublicosService],
})
export class ServiciosPublicosModule {}

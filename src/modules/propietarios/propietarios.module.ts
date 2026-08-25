import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Propietario } from './entities/propietario.entity';
import { PropietariosService } from './propietarios.service';
import { PropietariosController } from './propietarios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Propietario])],
  controllers: [PropietariosController],
  providers: [PropietariosService],
  exports: [PropietariosService],
})
export class PropietariosModule {}

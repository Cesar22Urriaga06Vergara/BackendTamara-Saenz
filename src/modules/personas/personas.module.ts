import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { Codeudor } from './entities/codeudor.entity';
import { ClientesService, CodeudoresService } from './personas.service';
import { ClientesController } from './clientes.controller';
import { CodeudoresController } from './codeudores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, Codeudor])],
  controllers: [ClientesController, CodeudoresController],
  providers: [ClientesService, CodeudoresService],
  exports: [ClientesService, CodeudoresService],
})
export class PersonasModule {}

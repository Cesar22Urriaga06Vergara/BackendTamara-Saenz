import { Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { PersonasServiceBase } from './personas.service';
import { BuscarPersonaDto } from './dto/buscar-persona.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';

/**
 * Rutas de solo lectura compartidas entre `ClientesController` y `CodeudoresController`:
 * ambos exponen exactamente los mismos endpoints sobre `PersonasServiceBase<T>` (mismo
 * comportamiento de directorio, entidades TypeORM distintas — ver `personas.service.ts`).
 *
 * `crear`/`actualizar` NO se comparten aquí: `@AuditAction` fija un `modulo` distinto
 * ('CLIENTES'/'CODEUDORES') por decorador, así que esos dos métodos quedan declarados en
 * cada controlador concreto (siguen siendo un one-liner cada uno). NestJS descubre las rutas
 * heredadas de esta clase base normalmente (recorre la cadena de prototipos al escanear el
 * controlador), pero la inyección de dependencias del constructor SÍ requiere que cada
 * subclase concreta declare su propio constructor — por eso `service` es un campo abstracto,
 * no inyectado aquí.
 */
export abstract class PersonasControllerBase<T extends { id: string }> {
  protected abstract readonly service: PersonasServiceBase<T & { numeroDocumento: string; activo: boolean }>;

  /** Búsqueda estricta usada por el flujo de contratación (por cédula preferente). */
  @Get('buscar')
  buscar(@Query() filtro: BuscarPersonaDto) {
    return this.service.buscar(filtro);
  }

  @Get()
  listar(@Query() filtro: PaginacionDto) {
    return this.service.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }
}

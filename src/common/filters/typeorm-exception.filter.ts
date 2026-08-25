import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Red de seguridad para violaciones de restricciones de base de datos que ningún
 * validador de negocio anticipó explícitamente (AUD-018). Sin este filtro, esos casos
 * llegaban al cliente como un 500 genérico sin mensaje útil; ahora se traducen a un
 * código HTTP y mensaje claros para los códigos de error MySQL más comunes. No
 * reemplaza las validaciones de negocio ya existentes (ConflictException explícitos,
 * etc.) — solo cubre lo que se les escapa.
 */
@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const driverError = (exception as any).driverError ?? {};
    const codigo: string | undefined = driverError.code;

    const mapeo: Record<string, () => HttpException> = {
      ER_DUP_ENTRY: () => new ConflictException('Ya existe un registro con ese valor único.'),
      ER_NO_REFERENCED_ROW_2: () =>
        new HttpException('El registro referenciado no existe o ya fue eliminado.', 400),
      ER_ROW_IS_REFERENCED_2: () =>
        new HttpException('No es posible completar la operación: hay registros relacionados que dependen de este.', 409),
      ER_BAD_NULL_ERROR: () => new HttpException('Falta un valor obligatorio para completar el registro.', 400),
      ER_DATA_TOO_LONG: () => new HttpException('Uno de los valores enviados excede la longitud permitida.', 400),
    };

    const httpException = codigo && mapeo[codigo] ? mapeo[codigo]() : new HttpException('Error al procesar la solicitud en base de datos.', 400);
    const status = httpException.getStatus();
    const body = httpException.getResponse();

    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}

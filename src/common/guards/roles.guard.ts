import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Rol } from '../enums/roles.enum';

/** Métodos HTTP que mutan estado y por eso exigen @Roles explícito por defecto. */
const METODOS_MUTANTES = ['POST', 'PUT', 'PATCH', 'DELETE'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { method, user } = context.switchToHttp().getRequest();

    if (!requiredRoles || requiredRoles.length === 0) {
      // Sin @Roles: las lecturas quedan abiertas a cualquier autenticado (comportamiento
      // previo), pero los métodos mutantes se deniegan por defecto (fail-closed) para que
      // un endpoint de escritura nunca quede desprotegido por un @Roles olvidado.
      if (METODOS_MUTANTES.includes(method)) {
        throw new ForbiddenException(
          'Acceso restringido. Este endpoint de escritura no declara los roles permitidos (@Roles) y se deniega por defecto.',
        );
      }
      return true;
    }

    if (!user || !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException(
        `Acceso restringido. Este recurso requiere rol: ${requiredRoles.join(', ')}. ` +
          'El rol Recepcionista no tiene permitido operar dinero, recibos ni reportes contables.',
      );
    }
    return true;
  }
}

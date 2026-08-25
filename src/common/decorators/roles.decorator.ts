import { SetMetadata } from '@nestjs/common';
import { Rol } from '../enums/roles.enum';

export const ROLES_KEY = 'roles';
/** Decorador de autorización RBAC. Uso: @Roles(Rol.ADMINISTRADOR) */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

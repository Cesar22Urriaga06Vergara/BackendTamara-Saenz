import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extrae el usuario autenticado inyectado por JwtStrategy (req.user). */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

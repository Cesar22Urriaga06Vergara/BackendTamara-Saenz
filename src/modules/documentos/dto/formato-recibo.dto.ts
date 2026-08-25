import { IsIn, IsOptional } from 'class-validator';

/**
 * `formato` llegaba antes como `@Query('formato') formato: string` suelto, sin pasar por
 * `ValidationPipe` (los parámetros `@Query()` primitivos no se validan con `class-validator`,
 * solo las clases decoradas con `@Query() dto: Clase`). Cualquier valor distinto de `'CARTA'`
 * caía silenciosamente en el layout `MEDIA_CARTA` en `PdfReciboService.generar()` en vez de
 * ser rechazado — un error de tipeo en el cliente producía el PDF equivocado sin avisar.
 */
export class FormatoReciboDto {
  @IsOptional() @IsIn(['CARTA', 'MEDIA_CARTA']) formato?: 'CARTA' | 'MEDIA_CARTA';
}

import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

/** Nunca se sanitizan credenciales: alterar el password rompería el login del usuario. */
const CAMPOS_EXCLUIDOS = ['password'];

/**
 * Pipe global de sanitización contra XSS almacenado: limpia todo string del body
 * de la request (recursivamente) antes de que ValidationPipe transforme/valide el DTO.
 * No se aplica a query params ni a route params — solo al body.
 */
@Injectable()
export class SanitizarHtmlPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' || value === null || typeof value !== 'object') return value;
    return this.limpiarObjeto(value);
  }

  private limpiarObjeto(obj: any): any {
    if (Array.isArray(obj)) return obj.map((v) => this.limpiarValor(v));

    const resultado: any = {};
    for (const [clave, valor] of Object.entries(obj)) {
      resultado[clave] = CAMPOS_EXCLUIDOS.includes(clave.toLowerCase()) ? valor : this.limpiarValor(valor);
    }
    return resultado;
  }

  private limpiarValor(valor: any): any {
    if (typeof valor === 'string') return sanitizeHtml(valor, { allowedTags: [], allowedAttributes: {} });
    if (valor !== null && typeof valor === 'object') return this.limpiarObjeto(valor);
    return valor;
  }
}

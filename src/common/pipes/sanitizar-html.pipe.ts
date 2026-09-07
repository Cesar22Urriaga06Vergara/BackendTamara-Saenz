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
    if (typeof valor === 'string') {
      const sanitizado = sanitizeHtml(valor, { allowedTags: [], allowedAttributes: {} });
      return this.decodificarEntidadesBasicas(sanitizado);
    }
    if (valor !== null && typeof valor === 'object') return this.limpiarObjeto(valor);
    return valor;
  }

  /**
   * `sanitizeHtml` con `allowedTags: []` ya garantiza que ningún tag real sobrevive (protección
   * XSS intacta) — pero su serializador interno igual codifica como entidad HTML los caracteres
   * `& < >` que quedan como texto plano (ej. "Tamara & Saenz" -> "Tamara &amp; Saenz"),
   * corrompiendo en silencio datos de negocio legítimos (nombres, razones sociales). Decodificarlos
   * de vuelta es seguro: no queda ninguna estructura de tag en el resultado que pudiera
   * "reactivarse", y este sistema nunca renderiza estos valores como HTML (sin `v-html` en el
   * frontend; PDFKit dibuja texto literal) — solo como texto plano, donde `&`/`<`/`>` no son
   * peligrosos.
   */
  private decodificarEntidadesBasicas(texto: string): string {
    return texto
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
}

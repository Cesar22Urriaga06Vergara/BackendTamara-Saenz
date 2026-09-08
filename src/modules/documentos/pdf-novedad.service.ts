import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { EstadoNovedad, Novedad } from '../novedades/entities/novedad.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { fechaLocalDesdeString } from '../../common/utils/fecha.util';
import { rutaFisicaDesdeUrlPublica } from '../../common/utils/rutas-archivos.util';

const COLOR_TEXTO = '#1A1A1A';
const COLOR_GRIS = '#4A4D52';
const COLOR_ORO = '#CFA052';
const COLOR_ORO_CLARO = '#FBF3E4';
const COLOR_BORDE = '#D9D9D9';
const COLOR_DIVISOR = '#E5E7EB';

/** Color de acento por estado: se usa en la insignia de la tarjeta y, para ANULADA, en el banner de aviso. */
const COLOR_ESTADO: Record<string, string> = {
  ABIERTA: '#CFA052',
  EN_SEGUIMIENTO: '#2563EB',
  CERRADA: '#16A34A',
  ANULADA: '#DC2626',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_SEGUIMIENTO: 'En seguimiento',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
};

const ETIQUETA_RESPONSABLE: Record<string, string> = {
  INMOBILIARIA: 'Inmobiliaria',
  ARRENDATARIO: 'Arrendatario',
};

/** Mismas 3 etiquetas que `useEstados.ts` (frontend) para el dominio `impactoFinanciero`. */
const ETIQUETA_IMPACTO: Record<string, string> = {
  PENDIENTE: 'Pendiente de aprobación financiera',
  CARGO_ARRENDATARIO: 'Cargo al arrendatario',
  GASTO_INMOBILIARIA: 'Gasto de la inmobiliaria',
};

/**
 * Genera el "Recibo de reporte de novedad": documento de control interno para
 * Recepción/Administrador, que declara el impacto financiero (tipo, monto aprobado y estado de
 * pago) cuando ya existe, además de la descripción — pero no reemplaza ni anticipa el Recibo de
 * Caja ni constituye por sí mismo la aprobación financiera del Administrador (ver aviso en el
 * propio documento): solo deja constancia de lo que el sistema ya registró.
 */
@Injectable()
export class PdfNovedadService {
  generar(
    novedad: Novedad,
    empresa: Pick<Empresa, 'nombre' | 'nit' | 'slogan' | 'direccion' | 'telefono' | 'logoUrl'>,
  ): Promise<Buffer> {
    const tamano: [number, number] = [612, 792];
    const margenX = 40;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: tamano,
        margins: { top: margenX, bottom: margenX, left: margenX, right: margenX },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ---- Logo + encabezado corporativo (mismo patrón de PdfReciboService) ----
      let yTrasLogo = doc.y;
      if (empresa.logoUrl) {
        const rutaFisicaLogo = rutaFisicaDesdeUrlPublica(empresa.logoUrl);
        if (existsSync(rutaFisicaLogo)) {
          // Mismo tamaño base que PdfReciboService (112x80, +25% respecto al anterior 90x64) —
          // este documento no tiene variante Media Carta, no hace falta escalar.
          const anchoLogo = 112;
          const altoLogo = 80;
          doc.image(rutaFisicaLogo, tamano[0] - margenX - anchoLogo, doc.y, { fit: [anchoLogo, altoLogo] });
          yTrasLogo = doc.y + altoLogo + 10;
        }
      }

      doc.fillColor(COLOR_TEXTO).fontSize(16).font('Helvetica-Bold').text(empresa.nombre, { align: 'left' });
      doc.fillColor(COLOR_ORO).fontSize(10).font('Helvetica-Oblique').text(`"${empresa.slogan}"`, { align: 'left' });
      doc.fillColor(COLOR_GRIS).fontSize(9).font('Helvetica').text(`NIT: ${empresa.nit}`);
      if (empresa.direccion) doc.text(`Dirección: ${empresa.direccion}`);
      if (empresa.telefono) doc.text(`Tel: ${empresa.telefono}`);
      doc.moveDown(0.5);
      doc.y = Math.max(doc.y, yTrasLogo);
      doc
        .strokeColor(COLOR_ORO)
        .lineWidth(2)
        .moveTo(margenX, doc.y)
        .lineTo(tamano[0] - margenX, doc.y)
        .stroke();
      doc.moveDown(1);

      // ---- Título y consecutivo ----
      doc
        .fillColor(COLOR_TEXTO)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('RECIBO DE REPORTE DE NOVEDAD', { align: 'center' });
      doc
        .fillColor(COLOR_ORO)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`No. ${novedad.consecutivo ?? '—'}`, { align: 'center' });
      doc.moveDown(0.3);

      // ---- Aviso: documento de control interno, sin impacto financiero ----
      const anchoContenido = tamano[0] - margenX * 2;
      doc
        .fillColor(COLOR_GRIS)
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .text(
          'Documento de control interno. No constituye recibo de caja ni aprobación financiera; ' +
            'el cargo a cobrar (cliente o inmobiliaria) queda sujeto a la aprobación del Administrador.',
          { align: 'center', width: anchoContenido },
        );
      doc.moveDown(0.8);

      // ---- Banner de ANULADA: mismo criterio que PdfReciboService con recibos ANULADO (AUD-010) —
      // una novedad anulada nunca debe imprimirse de forma indistinguible de una vigente.
      if ((novedad.estado as string) === EstadoNovedad.ANULADA) {
        const altoBanner = 26;
        doc.rect(margenX, doc.y, anchoContenido, altoBanner).fill(COLOR_ESTADO.ANULADA);
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text('NOVEDAD ANULADA', margenX, doc.y + 7, { width: anchoContenido, align: 'center' });
        doc.y += altoBanner + 14;
      }

      // ---- Tarjeta de datos: Fecha/Estado, Inmueble/Responsable, Contrato, Registro/Emisión ----
      // El contrato NUNCA se identifica por su UUID interno (no es un dato legible ni útil para
      // quien lee el recibo impreso): se muestra por cliente + fecha de inicio, igual que
      // PdfReciboService identifica el contrato del recibo de caja por cliente + inmueble.
      const contrato = novedad.contrato as any;
      const textoContrato = contrato
        ? `${contrato.cliente?.nombreCompleto ?? '—'} (contrato desde ${this.formatoFechaCO(contrato.fechaInicio)})`
        : 'Sin contrato asociado';
      const textoInmueble = `${novedad.inmueble?.direccion ?? ''} (${novedad.inmueble?.barrio ?? ''})`;
      const textoResponsable = ETIQUETA_RESPONSABLE[novedad.responsableSugerido] ?? novedad.responsableSugerido;

      const padTarjeta = 14;
      const separacionColumnas = 20;
      const anchoColumna = (anchoContenido - padTarjeta * 2 - separacionColumnas) / 2;
      const anchoCompleto = anchoContenido - padTarjeta * 2;
      const xColIzq = margenX + padTarjeta;
      const xColDer = xColIzq + anchoColumna + separacionColumnas;
      const gapFilas = 8;
      const altoInsignia = 14;

      doc.font('Helvetica').fontSize(9);
      const altoFila1 = Math.max(
        doc.heightOfString(`Fecha: ${this.formatoFechaCO(novedad.fecha)}`, { width: anchoColumna }),
        altoInsignia,
      );
      const altoFila2 = Math.max(
        doc.heightOfString(`Inmueble: ${textoInmueble}`, { width: anchoColumna }),
        doc.heightOfString(`Responsable sugerido: ${textoResponsable}`, { width: anchoColumna }),
      );
      const altoFila3 = doc.heightOfString(`Contrato relacionado: ${textoContrato}`, { width: anchoCompleto });
      const altoFila4 = Math.max(
        doc.heightOfString(`Registrado por: ${novedad.registradoPorEmail ?? '—'}`, { width: anchoColumna }),
        doc.heightOfString(`Fecha de emisión: ${this.formatoFechaCO(new Date())}`, { width: anchoColumna }),
      );

      const yTarjeta = doc.y;
      const yFila1 = yTarjeta + padTarjeta;
      const yFila2 = yFila1 + altoFila1 + gapFilas;
      const yDivisor = yFila2 + altoFila2 + gapFilas;
      const yFila3 = yDivisor + gapFilas;
      const yFila4 = yFila3 + altoFila3 + gapFilas;
      const altoTarjeta = yFila4 + altoFila4 + padTarjeta - yTarjeta;

      doc
        .roundedRect(margenX, yTarjeta, anchoContenido, altoTarjeta, 4)
        .lineWidth(0.75)
        .strokeColor(COLOR_BORDE)
        .stroke();
      doc
        .strokeColor(COLOR_DIVISOR)
        .lineWidth(0.5)
        .moveTo(margenX + padTarjeta, yDivisor)
        .lineTo(margenX + anchoContenido - padTarjeta, yDivisor)
        .stroke();

      const celda = (etiqueta: string, valor: string, x: number, y: number, ancho: number) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLOR_TEXTO)
          .text(`${etiqueta} `, x, y, { continued: true, width: ancho });
        doc.font('Helvetica').fillColor(COLOR_GRIS).text(valor, { width: ancho });
      };

      celda('Fecha:', this.formatoFechaCO(novedad.fecha), xColIzq, yFila1, anchoColumna);

      // Insignia de estado: mismo color que el banner de ANULADA cuando aplica, para que el
      // color del banner y el de la tarjeta nunca se contradigan.
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO).text('Estado: ', xColDer, yFila1);
      const anchoEtiquetaEstado = doc.widthOfString('Estado: ');
      const textoEstado = ETIQUETA_ESTADO[novedad.estado] ?? novedad.estado;
      const colorEstado = COLOR_ESTADO[novedad.estado] ?? COLOR_GRIS;
      doc.font('Helvetica-Bold').fontSize(8);
      const anchoInsignia = doc.widthOfString(textoEstado) + 14;
      doc.roundedRect(xColDer + anchoEtiquetaEstado, yFila1 - 1, anchoInsignia, altoInsignia, 7).fill(colorEstado);
      doc
        .fillColor('#FFFFFF')
        .text(textoEstado, xColDer + anchoEtiquetaEstado + 7, yFila1 + 2, { width: anchoInsignia - 14 });

      celda('Inmueble:', textoInmueble, xColIzq, yFila2, anchoColumna);
      celda('Responsable sugerido:', textoResponsable, xColDer, yFila2, anchoColumna);

      celda('Contrato relacionado:', textoContrato, xColIzq, yFila3, anchoCompleto);

      celda('Registrado por:', novedad.registradoPorEmail ?? '—', xColIzq, yFila4, anchoColumna);
      celda('Fecha de emisión:', this.formatoFechaCO(new Date()), xColDer, yFila4, anchoColumna);

      doc.y = yTarjeta + altoTarjeta + 20;

      // ---- Impacto financiero: el costo real declarado explícitamente, no solo la descripción
      // textual — mismo criterio del Recibo de Caja (que declara cada medio de pago línea por
      // línea, no solo un total). Se dibuja como líneas sueltas (no una tarjeta de grilla fija
      // como la de arriba) porque el número de líneas varía según impactoFinanciero/gastoPagado;
      // una grilla de alto precalculado obligaría a recalcular esa tarjeta ante cada combinación. ----
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_TEXTO).text('Impacto financiero', margenX, doc.y);
      doc.moveDown(0.35);

      const lineaDato = (etiqueta: string, valor: string) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLOR_TEXTO)
          .text(`${etiqueta} `, margenX + 12, doc.y, { continued: true, width: anchoContenido - 12 });
        doc.font('Helvetica').fillColor(COLOR_GRIS).text(valor);
        doc.moveDown(0.3);
      };

      lineaDato('Tipo:', ETIQUETA_IMPACTO[novedad.impactoFinanciero] ?? novedad.impactoFinanciero);

      if (novedad.montoAprobado != null) {
        const altoCajaMonto = 22;
        const yCajaMonto = doc.y;
        doc.roundedRect(margenX, yCajaMonto, anchoContenido, altoCajaMonto, 4).fill(COLOR_ORO_CLARO);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(COLOR_TEXTO)
          .text('Monto: ', margenX + 12, yCajaMonto + 5, { continued: true, width: anchoContenido - 24 })
          .text(this.formatoMonedaCO(novedad.montoAprobado), { align: 'right' });
        doc.y = yCajaMonto + altoCajaMonto + 8;
      }

      if (novedad.aprobadoPorEmail) {
        lineaDato('Aprobado por:', novedad.aprobadoPorEmail);
      }

      if ((novedad.impactoFinanciero as string) === 'GASTO_INMOBILIARIA') {
        lineaDato('Estado de pago:', novedad.gastoPagado ? 'Pagado' : 'Pendiente de pago');
        if (novedad.gastoPagado) {
          const medio = novedad.medioPagoGasto ?? '—';
          lineaDato(
            'Medio de pago:',
            novedad.referenciaPagoGasto ? `${medio} (Ref: ${novedad.referenciaPagoGasto})` : medio,
          );
          if (novedad.fechaPagoGasto) lineaDato('Fecha de pago:', this.formatoFechaCO(novedad.fechaPagoGasto));
          if (novedad.pagadoPorEmail) lineaDato('Pagado por:', novedad.pagadoPorEmail);
        }
      }

      doc.moveDown(0.4);

      // ---- Descripción / Observaciones: bloque con barra de acento, igual criterio visual del
      // divisor dorado del encabezado (gris para observaciones, para diferenciarlo del cuerpo). ----
      const bloqueTexto = (titulo: string, texto: string, colorAcento: string) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO).text(titulo, margenX, doc.y);
        doc.moveDown(0.25);
        const yTexto = doc.y;
        doc
          .font('Helvetica')
          .fontSize(9.5)
          .fillColor(COLOR_TEXTO)
          .text(texto, margenX + 12, yTexto, { width: anchoContenido - 12 });
        doc
          .strokeColor(colorAcento)
          .lineWidth(2.5)
          .moveTo(margenX + 2, yTexto - 1)
          .lineTo(margenX + 2, doc.y - 2)
          .stroke();
        doc.moveDown(0.7);
      };

      bloqueTexto('Descripción', novedad.descripcion, COLOR_ORO);
      if (novedad.observaciones) {
        bloqueTexto('Observaciones', novedad.observaciones, COLOR_GRIS);
      }

      doc.moveDown(0.8);
      doc
        .strokeColor(COLOR_DIVISOR)
        .lineWidth(0.5)
        .moveTo(margenX, doc.y)
        .lineTo(tamano[0] - margenX, doc.y)
        .stroke();
      doc.moveDown(0.6);
      doc
        .fillColor(COLOR_GRIS)
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('Documento generado por el sistema — no requiere firma manuscrita.', { align: 'center' });

      doc.end();
    });
  }

  /**
   * `novedad.fecha` es una columna `type: 'date'`, hidratada por TypeORM como STRING
   * "YYYY-MM-DD" (no `Date`, pese al tipo declarado en la entidad) — `new Date(fecha)`
   * directamente sobre ese string cae en el mismo off-by-one de MORA-01/CONT-04 en una zona
   * horaria negativa. Se normaliza con `fechaLocalDesdeString` antes de formatear. Misma
   * columna y mismo mecanismo aplican a `contrato.fechaInicio`.
   */
  private formatoFechaCO(fecha: Date | string): string {
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      fechaLocalDesdeString(fecha),
    );
  }

  /** Mismo formato que `PdfReciboService.formatoMonedaCO` — un solo criterio visual de moneda. */
  private formatoMonedaCO(valor: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      Number(valor),
    );
  }
}

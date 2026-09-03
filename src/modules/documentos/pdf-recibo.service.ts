import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { EstadoRecibo, ReciboCaja } from '../recaudo/entities/recibo-caja.entity';
import { Empresa } from '../empresa/entities/empresa.entity';

/**
 * Genera el Recibo de Caja oficial en PDF vectorial (PDFKit), en formato
 * Carta (216x279mm / 612x792pt) o Media Carta (216x140mm / 612x396pt),
 * con el encabezado corporativo y el slogan "Resolvemos tu situación".
 * RESTRICCIÓN: sin soporte de vouchers ni impresión térmica de 58mm.
 */
@Injectable()
export class PdfReciboService {
  generar(
    recibo: ReciboCaja,
    empresa: Pick<Empresa, 'nombre' | 'nit' | 'slogan' | 'direccion' | 'telefono' | 'logoUrl'>,
    formato: 'CARTA' | 'MEDIA_CARTA' = 'CARTA',
  ): Promise<Buffer> {
    const tamano: [number, number] = formato === 'CARTA' ? [612, 792] : [612, 396];
    const margenX = 40;
    const esMediaCarta = formato === 'MEDIA_CARTA';

    // Media carta comprime ligeramente el espaciado vertical (márgenes Y, gaps
    // internos y altura de fila) para que el recibo completo, incluida la línea
    // de cierre, quepa siempre en una sola hoja.
    const margenY = esMediaCarta ? 24 : margenX;
    const espaciado = {
      gapPeque: esMediaCarta ? 5 : 8,
      padFila: esMediaCarta ? 6 : 10,
      gapPostTarjeta: esMediaCarta ? 10 : 20,
      altoFila: esMediaCarta ? 17 : 20,
      escala: esMediaCarta ? 0.55 : 1,
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: tamano,
        margins: { top: margenY, bottom: margenY, left: margenX, right: margenX },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ---- Logo (si el Administrador ya subió uno desde Configuración) ----
      // logoUrl guarda la ruta pública ("/uploads/empresa/<archivo>"); la ruta física en
      // disco es esa misma ruta resuelta contra la raíz del proyecto (ver EmpresaService).
      let yTrasLogo = doc.y;
      if (empresa.logoUrl) {
        const rutaFisicaLogo = join(process.cwd(), empresa.logoUrl);
        if (existsSync(rutaFisicaLogo)) {
          // Tamaño +28% respecto al original (70x50 -> 90x64), misma relación de aspecto vía `fit`.
          const anchoLogo = 90;
          const altoLogo = 64;
          doc.image(rutaFisicaLogo, tamano[0] - margenX - anchoLogo, doc.y, { fit: [anchoLogo, altoLogo] });
          yTrasLogo = doc.y + altoLogo + 10;
        }
      }

      // ---- Encabezado corporativo (siempre desde la ficha de Empresa en BD) ----
      doc.fillColor('#1A1A1A').fontSize(16).font('Helvetica-Bold').text(empresa.nombre, { align: 'left' });
      doc.fillColor('#CFA052').fontSize(10).font('Helvetica-Oblique').text(`"${empresa.slogan}"`, { align: 'left' });
      doc.fillColor('#4A4D52').fontSize(9).font('Helvetica').text(`NIT: ${empresa.nit}`);
      if (empresa.direccion) doc.text(`Dirección: ${empresa.direccion}`);
      if (empresa.telefono) doc.text(`Tel: ${empresa.telefono}`);
      doc.moveDown(0.5 * espaciado.escala);
      doc.y = Math.max(doc.y, yTrasLogo);
      doc
        .strokeColor('#CFA052')
        .lineWidth(2)
        .moveTo(40, doc.y)
        .lineTo(tamano[0] - 40, doc.y)
        .stroke();
      doc.moveDown(1 * espaciado.escala);

      // ---- Título y consecutivo ----
      doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold').text('RECIBO DE CAJA', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`No. ${recibo.consecutivo}`, { align: 'center' });
      doc.moveDown(0.5 * espaciado.escala);

      // ---- Banner de ANULADO: un recibo anulado nunca debe generar un PDF indistinguible
      // de uno vigente (AUD-010). Se muestra de forma prominente, con el motivo si existe.
      if (recibo.estado === EstadoRecibo.ANULADO) {
        const anchoBanner = tamano[0] - margenX * 2;
        const altoBanner = esMediaCarta ? 20 : 26;
        doc.rect(margenX, doc.y, anchoBanner, altoBanner).fill('#DC2626');
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(esMediaCarta ? 10 : 12)
          .text('RECIBO ANULADO', margenX, doc.y + (esMediaCarta ? 5 : 7), { width: anchoBanner, align: 'center' });
        doc.y += altoBanner + 4;
        if (recibo.motivoAnulacion) {
          doc
            .fillColor('#DC2626')
            .font('Helvetica')
            .fontSize(8.5)
            .text(`Motivo de anulación: ${recibo.motivoAnulacion}`, margenX, doc.y, {
              width: anchoBanner,
              align: 'center',
            });
        }
      }

      doc.moveDown(1 * espaciado.escala);

      // ---- Tarjeta: Arrendatario / Documento / Inmueble / Fecha (2 filas x 2 columnas) ----
      const contrato = recibo.contrato as any;
      const anchoContenido = tamano[0] - margenX * 2;
      const padTarjeta = 14;
      const separacionColumnas = 20;
      const anchoColumna = (anchoContenido - padTarjeta * 2 - separacionColumnas) / 2;
      const xColIzq = margenX + padTarjeta;
      const xColDer = xColIzq + anchoColumna + separacionColumnas;

      const txtArrendatario = `Arrendatario: ${contrato.cliente?.nombreCompleto ?? '—'}`;
      const txtDocumento = `Documento: ${contrato.cliente?.numeroDocumento ?? '—'}`;
      const txtInmueble = `Inmueble: ${contrato.inmueble?.direccion ?? ''} (${contrato.inmueble?.barrio ?? ''})`;
      const txtFecha = `Fecha de emisión: ${this.formatoFechaCO(recibo.creadoEn)}`;

      doc.font('Helvetica').fontSize(9);
      const altoFila1 = Math.max(
        doc.heightOfString(txtArrendatario, { width: anchoColumna }),
        doc.heightOfString(txtDocumento, { width: anchoColumna }),
      );
      const altoFila2 = Math.max(
        doc.heightOfString(txtInmueble, { width: anchoColumna }),
        doc.heightOfString(txtFecha, { width: anchoColumna }),
      );

      const padFilaTarjeta = espaciado.padFila;
      const yTarjeta = doc.y;
      const yFila1 = yTarjeta + padFilaTarjeta;
      const yDivisor = yFila1 + altoFila1 + espaciado.gapPeque;
      const yFila2 = yDivisor + espaciado.gapPeque;
      const altoTarjeta = yFila2 + altoFila2 + padFilaTarjeta - yTarjeta;

      doc
        .roundedRect(margenX, yTarjeta, anchoContenido, altoTarjeta, 4)
        .lineWidth(0.75)
        .strokeColor('#D9D9D9')
        .stroke();
      doc
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .moveTo(margenX + padTarjeta, yDivisor)
        .lineTo(margenX + anchoContenido - padTarjeta, yDivisor)
        .stroke();

      const celdaEtiquetaValor = (etiqueta: string, valor: string, x: number, y: number) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#1A1A1A')
          .text(`${etiqueta} `, x, y, { continued: true, width: anchoColumna });
        doc.font('Helvetica').fillColor('#4A4D52').text(valor, { width: anchoColumna });
      };
      celdaEtiquetaValor('Arrendatario:', contrato.cliente?.nombreCompleto ?? '—', xColIzq, yFila1);
      celdaEtiquetaValor('Documento:', contrato.cliente?.numeroDocumento ?? '—', xColDer, yFila1);
      celdaEtiquetaValor(
        'Inmueble:',
        `${contrato.inmueble?.direccion ?? ''} (${contrato.inmueble?.barrio ?? ''})`,
        xColIzq,
        yFila2,
      );
      celdaEtiquetaValor('Fecha de emisión:', this.formatoFechaCO(recibo.creadoEn), xColDer, yFila2);

      doc.y = yTarjeta + altoTarjeta + espaciado.gapPostTarjeta;

      // ---- Tabla de detalle de pago (CANT. / DESCRIPCIÓN / PRECIO UNITARIO / TOTAL) ----
      // Un recibo de caja no tiene línea de "producto" con cantidad/precio unitario real:
      // cada fila es un medio de pago por su monto total, así que CANT. es siempre 1 y
      // PRECIO UNITARIO == TOTAL para esa fila (no se inventan datos que no existen).
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1A1A').text('Detalle de pago', margenX, doc.y);
      doc.moveDown(0.4 * espaciado.escala);

      const colCantX = margenX;
      const colCantW = 50;
      const colDescX = colCantX + colCantW;
      const colDescW = 250;
      const colPuX = colDescX + colDescW;
      const colPuW = 116;
      const colTotalX = colPuX + colPuW;
      const colTotalW = 116;
      const altoFilaTabla = espaciado.altoFila;

      const yEncabezado = doc.y;
      doc.rect(margenX, yEncabezado, anchoContenido, altoFilaTabla).fill('#4A4D52');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('CANT.', colCantX, yEncabezado + 6, { width: colCantW, align: 'center' });
      doc.text('DESCRIPCIÓN', colDescX + 6, yEncabezado + 6, { width: colDescW - 6, align: 'left' });
      doc.text('PRECIO UNITARIO', colPuX, yEncabezado + 6, { width: colPuW - 6, align: 'right' });
      doc.text('TOTAL', colTotalX, yEncabezado + 6, { width: colTotalW - 6, align: 'right' });

      let yFilaTabla = yEncabezado + altoFilaTabla;
      recibo.detallesPago.forEach((detalle) => {
        const descripcion = `${detalle.medioPago}${detalle.referencia ? ` (Ref: ${detalle.referencia})` : ''}`;
        const montoFormateado = this.formatoMonedaCO(detalle.monto);
        doc.font('Helvetica').fontSize(9).fillColor('#1A1A1A');
        doc.text('1', colCantX, yFilaTabla + 6, { width: colCantW, align: 'center' });
        doc.text(descripcion, colDescX + 6, yFilaTabla + 6, { width: colDescW - 6, align: 'left' });
        doc.text(montoFormateado, colPuX, yFilaTabla + 6, { width: colPuW - 6, align: 'right' });
        doc.text(montoFormateado, colTotalX, yFilaTabla + 6, { width: colTotalW - 6, align: 'right' });
        yFilaTabla += altoFilaTabla;
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(0.5)
          .moveTo(margenX, yFilaTabla)
          .lineTo(margenX + anchoContenido, yFilaTabla)
          .stroke();
      });

      doc.y = yFilaTabla + espaciado.gapPeque;

      // ---- Tabla de aplicación del pago (a qué obligación se destinó cada monto) ----
      // §20 de la especificación: el recibo debe explicar cómo se aplicó el dinero (concepto,
      // período, saldo posterior), no solo mostrar el total recibido por medio de pago.
      // `recibo.aplicaciones` puede venir vacío en recibos generados antes de este hallazgo
      // (RECAUDO-03) — en ese caso la tabla simplemente no se dibuja.
      if (recibo.aplicaciones && recibo.aplicaciones.length > 0) {
        doc.moveDown(0.6 * espaciado.escala);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1A1A1A').text('Aplicación del pago', margenX, doc.y);
        doc.moveDown(0.4 * espaciado.escala);

        const colConceptoX = margenX;
        const colConceptoW = 210;
        const colPeriodoX = colConceptoX + colConceptoW;
        const colPeriodoW = 110;
        const colValorX = colPeriodoX + colPeriodoW;
        const colValorW = 106;
        const colSaldoX = colValorX + colValorW;
        const colSaldoW = anchoContenido - colConceptoW - colPeriodoW - colValorW;

        const yEncabezadoAplic = doc.y;
        doc.rect(margenX, yEncabezadoAplic, anchoContenido, altoFilaTabla).fill('#4A4D52');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
        doc.text('CONCEPTO', colConceptoX + 6, yEncabezadoAplic + 6, { width: colConceptoW - 6, align: 'left' });
        doc.text('PERÍODO', colPeriodoX, yEncabezadoAplic + 6, { width: colPeriodoW - 6, align: 'left' });
        doc.text('VALOR APLIC.', colValorX, yEncabezadoAplic + 6, { width: colValorW - 6, align: 'right' });
        doc.text('SALDO POST.', colSaldoX, yEncabezadoAplic + 6, { width: colSaldoW - 6, align: 'right' });

        let yFilaAplic = yEncabezadoAplic + altoFilaTabla;
        recibo.aplicaciones.forEach((aplicacion) => {
          const obligacion = aplicacion.obligacion as any;
          doc.font('Helvetica').fontSize(8.5).fillColor('#1A1A1A');
          doc.text(obligacion?.concepto ?? '—', colConceptoX + 6, yFilaAplic + 6, {
            width: colConceptoW - 6,
            align: 'left',
          });
          doc.text(obligacion?.periodo ? this.formatoPeriodoCO(obligacion.periodo) : '—', colPeriodoX, yFilaAplic + 6, {
            width: colPeriodoW - 6,
            align: 'left',
          });
          doc.text(this.formatoMonedaCO(aplicacion.montoAplicado), colValorX, yFilaAplic + 6, {
            width: colValorW - 6,
            align: 'right',
          });
          doc.text(
            aplicacion.saldoPosterior != null ? this.formatoMonedaCO(aplicacion.saldoPosterior) : '—',
            colSaldoX,
            yFilaAplic + 6,
            { width: colSaldoW - 6, align: 'right' },
          );
          yFilaAplic += altoFilaTabla;
          doc
            .strokeColor('#E5E7EB')
            .lineWidth(0.5)
            .moveTo(margenX, yFilaAplic)
            .lineTo(margenX + anchoContenido, yFilaAplic)
            .stroke();
        });

        doc.y = yFilaAplic + espaciado.gapPeque;
      }

      doc
        .strokeColor('#4A4D52')
        .lineWidth(1)
        .moveTo(margenX, doc.y)
        .lineTo(tamano[0] - margenX, doc.y)
        .stroke();
      doc.moveDown(0.5 * espaciado.escala);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1A1A1A')
        .text('Valor total recibido: ', margenX, doc.y, { continued: true, width: anchoContenido })
        .text(this.formatoMonedaCO(recibo.valorTotal), { align: 'right' });
      if (Number(recibo.excedente) > 0) {
        // Por defecto el excedente se devuelve como cambio; solo queda como saldo a favor
        // cuando el cliente lo pidió expresamente (RDN-01, hallazgo RECAUDO-02 de la auditoría).
        const etiquetaExcedente = recibo.excedenteComoSaldoFavor
          ? 'Excedente aplicado a saldo a favor'
          : 'Cambio entregado';
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#CFA052')
          .text(`${etiquetaExcedente}: ${this.formatoMonedaCO(recibo.excedente)}`, margenX, doc.y, {
            width: anchoContenido,
          });
      }

      doc.moveDown(2 * espaciado.escala);
      doc
        .fillColor('#4A4D52')
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text('Documento generado por el sistema — no requiere firma manuscrita.', { align: 'center' });

      doc.end();
    });
  }

  private formatoMonedaCO(valor: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      Number(valor),
    );
  }

  private formatoFechaCO(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(fecha),
    );
  }

  /**
   * `obligacion.periodo` es una columna `type: 'date'`, hidratada por TypeORM como STRING
   * "YYYY-MM-DD" (no `Date`, pese al tipo declarado en la entidad). `new Date("YYYY-MM-DD")`
   * la interpreta como medianoche UTC, que en una zona horaria negativa cae en el día
   * calendario anterior — para "período" eso puede mostrar el mes equivocado en el día 1 de
   * cada mes (mismo mecanismo del hallazgo MORA-01). Se parsean los componentes directamente.
   */
  private formatoPeriodoCO(valor: Date | string): string {
    const fecha =
      typeof valor === 'string'
        ? (() => {
            const [anio, mes, dia] = valor.split('-').map(Number);
            return new Date(anio, mes - 1, dia);
          })()
        : new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(fecha);
  }
}

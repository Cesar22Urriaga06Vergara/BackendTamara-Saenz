import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { Novedad } from '../novedades/entities/novedad.entity';
import { Empresa } from '../empresa/entities/empresa.entity';

/**
 * Genera el "Recibo de reporte de novedad": documento de control interno para
 * Recepción, SIN impacto financiero (no reemplaza ni anticipa el Recibo de Caja
 * ni la aprobación financiera del Administrador — solo deja constancia de que la
 * novedad fue registrada, para archivo/control interno).
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
      const doc = new PDFDocument({ size: tamano, margins: { top: margenX, bottom: margenX, left: margenX, right: margenX } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ---- Logo + encabezado corporativo (mismo patrón de PdfReciboService) ----
      let yTrasLogo = doc.y;
      if (empresa.logoUrl) {
        const rutaFisicaLogo = join(process.cwd(), empresa.logoUrl);
        if (existsSync(rutaFisicaLogo)) {
          const anchoLogo = 90;
          const altoLogo = 64;
          doc.image(rutaFisicaLogo, tamano[0] - margenX - anchoLogo, doc.y, { fit: [anchoLogo, altoLogo] });
          yTrasLogo = doc.y + altoLogo + 10;
        }
      }

      doc.fillColor('#1A1A1A').fontSize(16).font('Helvetica-Bold').text(empresa.nombre, { align: 'left' });
      doc.fillColor('#CFA052').fontSize(10).font('Helvetica-Oblique').text(`"${empresa.slogan}"`, { align: 'left' });
      doc.fillColor('#4A4D52').fontSize(9).font('Helvetica').text(`NIT: ${empresa.nit}`);
      if (empresa.direccion) doc.text(`Dirección: ${empresa.direccion}`);
      if (empresa.telefono) doc.text(`Tel: ${empresa.telefono}`);
      doc.moveDown(0.5);
      doc.y = Math.max(doc.y, yTrasLogo);
      doc.strokeColor('#CFA052').lineWidth(2).moveTo(margenX, doc.y).lineTo(tamano[0] - margenX, doc.y).stroke();
      doc.moveDown(1);

      // ---- Título y consecutivo ----
      doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold').text('RECIBO DE REPORTE DE NOVEDAD', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`No. ${novedad.consecutivo ?? '—'}`, { align: 'center' });
      doc.moveDown(0.3);

      // ---- Aviso: documento de control interno, sin impacto financiero ----
      const anchoContenido = tamano[0] - margenX * 2;
      doc
        .fillColor('#4A4D52')
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .text(
          'Documento de control interno. No constituye recibo de caja ni aprobación financiera; ' +
            'el cargo a cobrar (cliente o inmobiliaria) queda sujeto a la aprobación del Administrador.',
          { align: 'center', width: anchoContenido },
        );
      doc.moveDown(1);

      // ---- Datos de la novedad ----
      const contrato = novedad.contrato as any;
      const fila = (etiqueta: string, valor: string) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#1A1A1A')
          .text(`${etiqueta} `, margenX, doc.y, { continued: true, width: anchoContenido });
        doc.font('Helvetica').fillColor('#4A4D52').text(valor, { width: anchoContenido });
        doc.moveDown(0.4);
      };

      fila('Fecha:', this.formatoFechaCO(novedad.fecha));
      fila('Inmueble:', `${novedad.inmueble?.direccion ?? ''} (${novedad.inmueble?.barrio ?? ''})`);
      fila('Contrato relacionado:', contrato ? `${contrato.consecutivo ?? contrato.id} — ${contrato.cliente?.nombreCompleto ?? '—'}` : 'Sin contrato asociado');
      fila('Responsable sugerido:', novedad.responsableSugerido);
      fila('Estado:', novedad.estado);
      fila('Registrado por:', novedad.registradoPorEmail ?? '—');

      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A1A1A').text('Descripción:', margenX, doc.y);
      doc.font('Helvetica').fontSize(9).fillColor('#4A4D52').text(novedad.descripcion, { width: anchoContenido });
      doc.moveDown(0.5);

      if (novedad.observaciones) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A1A1A').text('Observaciones:', margenX, doc.y);
        doc.font('Helvetica').fontSize(9).fillColor('#4A4D52').text(novedad.observaciones, { width: anchoContenido });
        doc.moveDown(0.5);
      }

      doc.moveDown(1.5);
      doc.fillColor('#4A4D52').fontSize(8).font('Helvetica-Oblique').text('Documento generado por el sistema — no requiere firma manuscrita.', { align: 'center' });

      doc.end();
    });
  }

  private formatoFechaCO(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fecha));
  }
}

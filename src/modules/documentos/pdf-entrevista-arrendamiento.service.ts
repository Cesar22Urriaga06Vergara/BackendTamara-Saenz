import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { join } from 'path';
import { Empresa } from '../empresa/entities/empresa.entity';
import { EntrevistaArrendamiento } from '../entrevistas-arrendamiento/entities/entrevista-arrendamiento.entity';

const COLOR_AZUL = '#363435';
const COLOR_AZUL_CLARO = '#F7F0E1';
const COLOR_DORADO = '#D2AF6D';
const COLOR_TEXTO = '#363435';
const COLOR_GRIS = '#AAABB0';
const COLOR_BORDE = '#D8D6D0';
const COLOR_AMBAR = '#8C6A2D';
const RUTA_LOGO_FIJO = join(__dirname, '../../assets/Logo.png');
const ESPACIO_PIE = 56;

type EmpresaPdf = Pick<Empresa, 'nombre' | 'nit' | 'slogan' | 'direccion' | 'telefono'>;
type FilaPdf = [string, string | number];

@Injectable()
export class PdfEntrevistaArrendamientoService {
  generar(entrevista: EntrevistaArrendamiento, empresa: EmpresaPdf): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 86, bottom: 58, left: 43, right: 43 },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.on('pageAdded', () => this.membrete(doc, empresa));

      this.encabezado(doc, entrevista, empresa);
      this.alertas(doc, entrevista);
      this.seccion(doc, 'CONTROL DEL EXPEDIENTE', [
        ['Estado actual', entrevista.estado],
        ['Creada por', entrevista.creadoPorEmail],
        ['Fecha de creación', this.fecha(entrevista.creadoEn)],
        ['Decidida por', entrevista.decididoPorEmail || '—'],
        ['Fecha de decisión', this.fecha(entrevista.decididoEn)],
        ['Motivo de decisión', entrevista.motivoDecision || '—'],
      ]);

      this.seccion(doc, '1. DATOS PERSONALES', [
        ['Nombre completo', entrevista.nombreCompleto],
        ['Tipo de documento', entrevista.tipoDocumento || 'CC'],
        ['Número de documento', entrevista.numeroDocumento],
        ['Fecha de nacimiento', `${this.fecha(entrevista.fechaNacimiento)} (${this.edad(entrevista.fechaNacimiento)})`],
        ['Estado civil', entrevista.estadoCivil || '—'],
        ['Teléfono', entrevista.telefono || '—'],
        ['Correo electrónico', entrevista.correoElectronico || '—'],
        ['Número de personas', entrevista.numeroPersonas ?? '—'],
        ['Detalle de personas', entrevista.detallePersonas || entrevista.personasInmueble || '—'],
      ]);

      const ingresos = Number(entrevista.ingresosMensuales || 0);
      const otrosIngresos = Number(entrevista.otrosIngresos || 0);
      this.seccion(doc, '2. INFORMACIÓN LABORAL Y ECONÓMICA', [
        ['Empresa o actividad económica', entrevista.empresaActividad || '—'],
        ['Cargo', entrevista.cargo || '—'],
        ['Tipo de contrato', entrevista.tipoContratoLaboral || '—'],
        ['Tiempo laborando', entrevista.tiempoLaborando || '—'],
        ['Ingresos mensuales', this.moneda(entrevista.ingresosMensuales)],
        ['Otros ingresos', this.moneda(entrevista.otrosIngresos)],
        ['Total de ingresos', this.moneda(ingresos + otrosIngresos)],
        ['Certificación laboral / extractos', entrevista.presentaSoportes ? 'Sí' : 'No'],
      ]);

      this.seccion(doc, '3. HISTORIAL DE ARRENDAMIENTO', [
        ['Dirección actual', entrevista.direccionActual || '—'],
        ['Tiempo en dirección actual', entrevista.tiempoDireccionActual || '—'],
        ['Motivo de mudanza', entrevista.motivoMudanza || '—'],
        ['Arrendador anterior', entrevista.arrendadorAnterior || '—'],
        ['Teléfono del arrendador anterior', entrevista.telefonoArrendadorAnterior || '—'],
        ['Problemas de pago', entrevista.problemasPago || '—'],
      ]);

      this.seccion(doc, '4. REFERENCIAS', [
        [
          'Laboral',
          this.referencia(
            entrevista.referenciaLaboral,
            entrevista.telefonoReferenciaLaboral,
            entrevista.empresaReferenciaLaboral,
          ),
        ],
        [
          'Personal',
          this.referencia(
            entrevista.referenciaPersonal,
            entrevista.telefonoReferenciaPersonal,
            entrevista.relacionReferenciaPersonal,
          ),
        ],
        [
          'Familiar',
          this.referencia(
            entrevista.referenciaFamiliar,
            entrevista.telefonoReferenciaFamiliar,
            entrevista.parentescoReferenciaFamiliar,
          ),
        ],
      ]);

      this.seccion(doc, '5. CONVIVENCIA Y CONDICIONES', [
        ['¿Tiene mascotas?', entrevista.tieneMascotas == null ? '—' : entrevista.tieneMascotas ? 'Sí' : 'No'],
        ['Detalle de mascotas', entrevista.detalleMascotas || entrevista.mascotas || '—'],
        ['¿Fuma?', entrevista.fuma == null ? '—' : entrevista.fuma ? 'Sí' : 'No'],
        ['Permanencia estimada', entrevista.permanenciaEstimada || '—'],
        ['¿Acepta estudio de crédito?', entrevista.aceptaEstudioCredito ? 'Sí' : 'No'],
        ['Observaciones', entrevista.observaciones || '—'],
      ]);

      if (entrevista.tieneFiador) {
        this.seccion(doc, '6. FIADOR O CODEUDOR', [
          ['Nombre completo', entrevista.fiadorNombreCompleto || '—'],
          ['Tipo de documento', entrevista.fiadorTipoDocumento || '—'],
          ['Número de documento', entrevista.fiadorNumeroDocumento || '—'],
          ['Teléfono', entrevista.fiadorTelefono || '—'],
          ['Dirección', entrevista.fiadorDireccion || '—'],
          ['Relación con el solicitante', entrevista.fiadorRelacion || '—'],
        ]);
      }

      if (entrevista.estado === 'APROBADA' || entrevista.estado === 'RECHAZADA') {
        this.seccion(doc, '7. DECISIÓN ADMINISTRATIVA', [
          ['Estado final', entrevista.estado],
          ['Decidido por', entrevista.decididoPorEmail || '—'],
          ['Fecha de decisión', this.fecha(entrevista.decididoEn)],
          ['Motivo / observaciones', entrevista.motivoDecision || '—'],
        ]);
        this.firma(doc, 'Firma del decisor');
      }

      this.seccion(doc, '8. FIRMA DEL SOLICITANTE', [
        ['Nombre del solicitante', entrevista.nombreCompleto],
        ['Documento', `${entrevista.tipoDocumento || 'CC'} ${entrevista.numeroDocumento}`],
        ['Acepta estudio de crédito', entrevista.aceptaEstudioCredito ? 'Sí' : 'No'],
        ['Fecha de firma', this.fecha(entrevista.fechaFirma)],
      ]);
      this.firma(doc, 'Firma manuscrita del solicitante');

      const rango = doc.bufferedPageRange();
      for (let pagina = 0; pagina < rango.count; pagina++) {
        doc.switchToPage(pagina);
        // `switchToPage` conserva el cursor de flujo de la última operación. Resetearlo evita
        // que `text()` interprete el pie como contenido posterior y abra otra página.
        doc.x = 43;
        doc.y = 0;
        this.pie(doc, entrevista, empresa, pagina + 1, rango.count);
      }
      doc.end();
    });
  }

  private encabezado(doc: PDFKit.PDFDocument, entrevista: EntrevistaArrendamiento, empresa: EmpresaPdf): void {
    this.membrete(doc, empresa);
    doc
      .moveDown(0.45)
      .fillColor(COLOR_AZUL)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('FORMATO DE ENTREVISTA DE ARRENDAMIENTO', { align: 'center' });
    doc.fillColor(COLOR_TEXTO).fontSize(10).text(`No. ${entrevista.consecutivo}`, { align: 'center' });
    doc.moveDown(0.55);
  }

  private membrete(doc: PDFKit.PDFDocument, empresa: EmpresaPdf): void {
    if (existsSync(RUTA_LOGO_FIJO)) {
      doc.image(RUTA_LOGO_FIJO, 419, 10, { cover: [133, 70], align: 'center', valign: 'center' });
    }
    doc
      .fillColor(COLOR_AZUL)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(empresa.nombre || 'Inversiones Tamara & Saenz', 43, 24, { width: 350, height: 18, ellipsis: true });
    doc.fillColor(COLOR_TEXTO).font('Helvetica').fontSize(8.5).text('Régimen de organización', 43, 46);
    doc.text(`NIT: ${empresa.nit}`, 43, 58);
    doc.strokeColor(COLOR_DORADO).lineWidth(1.8).moveTo(43, 76).lineTo(552, 76).stroke();
    doc.y = 84;
  }

  private alertas(doc: PDFKit.PDFDocument, entrevista: EntrevistaArrendamiento): void {
    const alertas: string[] = [];
    if (!entrevista.presentaSoportes) alertas.push('No registra certificación laboral o extractos.');
    if (!entrevista.aceptaEstudioCredito) alertas.push('No registra aceptación del estudio de crédito.');
    if (!alertas.length) return;
    const alto = 24 + alertas.length * 13;
    const y = doc.y;
    const limiteInferior = doc.page.maxY() - ESPACIO_PIE;
    if (y + alto + 8 > limiteInferior) doc.addPage();
    doc.roundedRect(43, doc.y, 509, alto, 4).fill('#FBF4E5');
    doc
      .fillColor(COLOR_AMBAR)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('ALERTAS DEL EXPEDIENTE', 53, y + 7);
    alertas.forEach((alerta, indice) =>
      doc
        .fillColor(COLOR_TEXTO)
        .font('Helvetica')
        .fontSize(8.5)
        .text(`• ${alerta}`, 58, y + 23 + indice * 13, { width: 480 }),
    );
    doc.y = y + alto + 8;
  }

  private seccion(doc: PDFKit.PDFDocument, titulo: string, filas: FilaPdf[]): void {
    doc.moveDown(0.55);
    if (doc.y + 60 > doc.page.maxY() - ESPACIO_PIE) doc.addPage();
    this.encabezadoSeccion(doc, titulo);
    filas.forEach(([etiqueta, valor]) => {
      const textoValor = this.valor(valor);
      doc.font('Helvetica-Bold').fontSize(8.5);
      const altoEtiqueta = doc.heightOfString(`${etiqueta}:`, { width: 150 });
      doc.font('Helvetica');
      const altoValor = doc.heightOfString(textoValor, { width: 337 });
      const altoFila = Math.max(altoEtiqueta, altoValor, 12);
      if (doc.y + altoFila + 8 > doc.page.maxY() - ESPACIO_PIE) {
        doc.addPage();
        this.encabezadoSeccion(doc, `${titulo} (CONTINUACIÓN)`);
      }
      const inicio = doc.y;
      doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(8.5).text(`${etiqueta}:`, 51, inicio, { width: 150 });
      doc.fillColor(COLOR_TEXTO).font('Helvetica').text(textoValor, 207, inicio, { width: 337 });
      doc.y = inicio + altoFila;
      doc
        .moveTo(51, doc.y + 2)
        .lineTo(544, doc.y + 2)
        .strokeColor('#E6E6E6')
        .lineWidth(0.4)
        .stroke();
      doc.y += 6;
    });
  }

  private encabezadoSeccion(doc: PDFKit.PDFDocument, titulo: string): void {
    const y = doc.y;
    doc.rect(43, y, 509, 20).fill(COLOR_AZUL_CLARO);
    doc
      .fillColor(COLOR_AZUL)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(titulo, 51, y + 6);
    doc.y = y + 28;
  }

  private firma(doc: PDFKit.PDFDocument, titulo: string): void {
    doc.moveDown(0.7);
    if (doc.y + 50 > doc.page.maxY() - ESPACIO_PIE) doc.addPage();
    doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(9).text(titulo);
    doc.moveDown(1.6).moveTo(51, doc.y).lineTo(270, doc.y).strokeColor(COLOR_BORDE).stroke();
    doc.fillColor(COLOR_GRIS).font('Helvetica').fontSize(8).text('Firma y fecha');
  }

  private pie(
    doc: PDFKit.PDFDocument,
    entrevista: EntrevistaArrendamiento,
    empresa: Pick<Empresa, 'nombre' | 'nit'>,
    pagina: number,
    total: number,
  ): void {
    doc.save();
    // A4 mide 841pt; con margen inferior de 58pt el área imprimible termina cerca de 783pt.
    // Mantener el pie dentro de ese límite evita que PDFKit cree páginas nuevas al escribirlo.
    doc.strokeColor(COLOR_BORDE).lineWidth(0.5).moveTo(43, 748).lineTo(552, 748).stroke();
    doc
      .fillColor(COLOR_GRIS)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`${entrevista.consecutivo} · ${empresa.nombre} · NIT ${empresa.nit}`, 43, 755, {
        lineBreak: false,
      });
    doc.text(`Generado: ${this.fecha(new Date())} · Página ${pagina} de ${total}`, 383, 755, {
      lineBreak: false,
    });
    doc.text('Documento generado automáticamente. No válido sin firma.', 43, 767, {
      lineBreak: false,
    });
    doc.restore();
  }

  private valor(valor: string | number): string {
    return valor === '' || valor == null ? '—' : String(valor);
  }

  private fecha(valor: Date | string | null): string {
    if (!valor) return '—';
    const fecha =
      typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00`) : new Date(valor);
    return Number.isNaN(fecha.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO').format(fecha);
  }

  private edad(valor: Date | string | null): string {
    if (!valor) return 'edad no registrada';
    const nacimiento = new Date(typeof valor === 'string' ? `${valor.slice(0, 10)}T00:00:00` : valor);
    if (Number.isNaN(nacimiento.getTime())) return 'edad no registrada';
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    if (
      hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
    )
      edad--;
    return `${edad} años`;
  }

  private moneda(valor: number | null): string {
    return valor == null
      ? '—'
      : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
  }

  private referencia(nombre: string | null, telefono: string | null, contexto: string | null): string {
    if (!nombre && !telefono && !contexto) return '—';
    return `${nombre || '—'} · ${telefono || '—'} · ${contexto || '—'}`;
  }
}

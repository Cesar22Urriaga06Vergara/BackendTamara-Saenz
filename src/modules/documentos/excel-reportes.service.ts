import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/**
 * Generador de reportes en Excel (.xlsx) — formato de salida oficial para
 * reportes operativos y financieros (barrio, contratos, recaudo).
 */
@Injectable()
export class ExcelReportesService {
  private aplicarEstiloEncabezado(worksheet: ExcelJS.Worksheet, row: number) {
    const fila = worksheet.getRow(row);
    fila.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4D52' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  }

  async reporteContratos(contratos: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Contratos');

    sheet.columns = [
      { header: 'Consecutivo interno', key: 'id', width: 36 },
      { header: 'Arrendatario', key: 'arrendatario', width: 30 },
      { header: 'Documento', key: 'documento', width: 18 },
      { header: 'Inmueble', key: 'inmueble', width: 35 },
      { header: 'Barrio', key: 'barrio', width: 20 },
      { header: 'Canon', key: 'canon', width: 16 },
      { header: 'Fecha inicio', key: 'fechaInicio', width: 16 },
      { header: 'Fecha fin', key: 'fechaFin', width: 16 },
      { header: 'Estado', key: 'estado', width: 16 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    contratos.forEach((c) => {
      sheet.addRow({
        id: c.id,
        arrendatario: c.cliente?.nombreCompleto,
        documento: c.cliente?.numeroDocumento,
        inmueble: c.inmueble?.direccion,
        barrio: c.inmueble?.barrio,
        canon: Number(c.canonValor),
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin ?? '—',
        estado: c.estado,
      });
    });
    sheet.getColumn('canon').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reporteRecaudo(recibos: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Recaudo');

    sheet.columns = [
      { header: 'Consecutivo', key: 'consecutivo', width: 16 },
      { header: 'Fecha', key: 'fecha', width: 16 },
      { header: 'Arrendatario', key: 'arrendatario', width: 30 },
      { header: 'Inmueble', key: 'inmueble', width: 35 },
      { header: 'Barrio', key: 'barrio', width: 20 },
      { header: 'Valor total', key: 'valorTotal', width: 16 },
      { header: 'Excedente', key: 'excedente', width: 16 },
      { header: 'Estado', key: 'estado', width: 14 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    recibos.forEach((r) => {
      sheet.addRow({
        consecutivo: r.consecutivo,
        fecha: r.creadoEn,
        arrendatario: r.contrato?.cliente?.nombreCompleto,
        inmueble: r.contrato?.inmueble?.direccion,
        barrio: r.contrato?.inmueble?.barrio,
        valorTotal: Number(r.valorTotal),
        excedente: Number(r.excedente),
        estado: r.estado,
      });
    });
    sheet.getColumn('valorTotal').numFmt = '$ #,##0';
    sheet.getColumn('excedente').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reportePorBarrio(inmuebles: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inmuebles por barrio');

    sheet.columns = [
      { header: 'Dirección', key: 'direccion', width: 35 },
      { header: 'Barrio', key: 'barrio', width: 20 },
      { header: 'Canon', key: 'canon', width: 16 },
      { header: 'Estado', key: 'estado', width: 16 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    inmuebles
      .sort((a, b) => (a.barrio ?? '').localeCompare(b.barrio ?? ''))
      .forEach((i) => {
        sheet.addRow({ direccion: i.direccion, barrio: i.barrio, canon: Number(i.canonValor), estado: i.estado });
      });
    sheet.getColumn('canon').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Reporte consolidado de cartera: obligaciones PENDIENTES/PARCIALES por contrato,
   * con saldo pendiente y mora acumulada (ya calculada por ObligacionesService).
   * Incluye una fila de totales al final para el resumen gerencial.
   */
  async reporteCartera(obligacionesPendientes: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cartera');

    sheet.columns = [
      { header: 'Arrendatario', key: 'arrendatario', width: 30 },
      { header: 'Documento', key: 'documento', width: 18 },
      { header: 'Inmueble', key: 'inmueble', width: 35 },
      { header: 'Barrio', key: 'barrio', width: 20 },
      { header: 'Concepto', key: 'concepto', width: 30 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Fecha vencimiento', key: 'fechaVencimiento', width: 18 },
      { header: 'Valor original', key: 'valorOriginal', width: 16 },
      { header: 'Valor abonado', key: 'valorAbonado', width: 16 },
      { header: 'Saldo pendiente', key: 'saldoPendiente', width: 16 },
      { header: 'Mora acumulada', key: 'moraAcumulada', width: 16 },
      { header: 'Estado', key: 'estado', width: 14 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    let totalSaldo = 0;
    let totalMora = 0;

    obligacionesPendientes.forEach((o) => {
      const saldoPendiente = Number(o.valorOriginal) - Number(o.valorAbonado);
      totalSaldo += saldoPendiente;
      totalMora += Number(o.valorMoraAcumulada ?? 0);

      sheet.addRow({
        arrendatario: o.contrato?.cliente?.nombreCompleto,
        documento: o.contrato?.cliente?.numeroDocumento,
        inmueble: o.contrato?.inmueble?.direccion,
        barrio: o.contrato?.inmueble?.barrio,
        concepto: o.concepto,
        tipo: o.tipo,
        fechaVencimiento: o.fechaVencimiento,
        valorOriginal: Number(o.valorOriginal),
        valorAbonado: Number(o.valorAbonado),
        saldoPendiente,
        moraAcumulada: Number(o.valorMoraAcumulada ?? 0),
        estado: o.estado,
      });
    });

    const filaTotales = sheet.addRow({
      arrendatario: 'TOTAL CARTERA',
      saldoPendiente: totalSaldo,
      moraAcumulada: totalMora,
    });
    filaTotales.font = { bold: true };
    filaTotales.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    ['valorOriginal', 'valorAbonado', 'saldoPendiente', 'moraAcumulada'].forEach((key) => {
      sheet.getColumn(key).numFmt = '$ #,##0';
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

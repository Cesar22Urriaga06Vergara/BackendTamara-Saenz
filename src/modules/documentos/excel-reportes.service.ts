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
        canon: c.canonValor,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin ?? '—',
        estado: c.estado,
      });
    });
    sheet.getColumn('canon').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Hallazgo B9 de la auditoría contable 2026-09-01: el reporte mezclaba en una sola columna
   * recibos `EMITIDO`, `ANULADO` y de liquidación de depósito (`esLiquidacionDeposito`, que no
   * mueve caja), sin distinción de tipo — un `SUM` manual de `Valor total` sobre la hoja
   * contaba dinero que en realidad se revirtió o que nunca entró a caja. Se agrega la columna
   * "Tipo de documento" y una fila de totales que solo suma recibos `EMITIDO` que no son
   * liquidación de depósito (el mismo universo que `DashboardService.metricasFinancieras`).
   */
  async reporteRecaudo(recibos: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Recaudo');

    sheet.columns = [
      { header: 'Consecutivo', key: 'consecutivo', width: 16 },
      { header: 'Fecha', key: 'fecha', width: 16 },
      { header: 'Arrendatario', key: 'arrendatario', width: 30 },
      { header: 'Inmueble', key: 'inmueble', width: 35 },
      { header: 'Barrio', key: 'barrio', width: 20 },
      { header: 'Tipo de documento', key: 'tipoDocumento', width: 20 },
      { header: 'Valor total', key: 'valorTotal', width: 16 },
      { header: 'Excedente', key: 'excedente', width: 16 },
      { header: 'Estado', key: 'estado', width: 14 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    let totalRecaudoNeto = 0;

    recibos.forEach((r) => {
      const tipoDocumento = r.esLiquidacionDeposito ? 'Liquidación depósito' : 'Pago';
      sheet.addRow({
        consecutivo: r.consecutivo,
        fecha: r.creadoEn,
        arrendatario: r.contrato?.cliente?.nombreCompleto,
        inmueble: r.contrato?.inmueble?.direccion,
        barrio: r.contrato?.inmueble?.barrio,
        tipoDocumento,
        valorTotal: r.valorTotal,
        excedente: r.excedente,
        estado: r.estado,
      });

      if (r.estado === 'EMITIDO' && !r.esLiquidacionDeposito) {
        totalRecaudoNeto += r.valorTotal - (r.excedenteComoSaldoFavor ? 0 : r.excedente);
      }
    });

    const filaTotales = sheet.addRow({
      consecutivo: 'TOTAL RECAUDO NETO (emitido, sin liquidaciones de depósito, sin cambio devuelto)',
      valorTotal: totalRecaudoNeto,
    });
    filaTotales.font = { bold: true };
    filaTotales.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
        sheet.addRow({ direccion: i.direccion, barrio: i.barrio, canon: i.canonValor, estado: i.estado });
      });
    sheet.getColumn('canon').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Reporte consolidado de novedades: cada fila representa un evento operativo con su
   * impacto financiero, estado y monto aprobado; en la hoja queda visible el cierre del
   * ciclo Novedad -> Aprobación -> Pago real.
   */
  async reporteNovedades(novedades: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Novedades');

    sheet.columns = [
      { header: 'Consecutivo', key: 'consecutivo', width: 18 },
      { header: 'Fecha', key: 'fecha', width: 16 },
      { header: 'Descripción', key: 'descripcion', width: 38 },
      { header: 'Inmueble', key: 'inmueble', width: 28 },
      { header: 'Barrio', key: 'barrio', width: 18 },
      { header: 'Cliente', key: 'cliente', width: 26 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Impacto financiero', key: 'impactoFinanciero', width: 22 },
      { header: 'Monto aprobado', key: 'montoAprobado', width: 16 },
      { header: 'Pagado', key: 'gastoPagado', width: 12 },
      { header: 'Responsable sugerido', key: 'responsableSugerido', width: 20 },
      { header: 'Responsable aprobación', key: 'aprobadoPorEmail', width: 24 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    novedades.forEach((n) => {
      sheet.addRow({
        consecutivo: n.consecutivo,
        fecha: n.fecha,
        descripcion: n.descripcion,
        inmueble: n.inmueble?.direccion,
        barrio: n.inmueble?.barrio,
        cliente: n.contrato?.cliente?.nombreCompleto ?? 'Sin contrato',
        estado: n.estado,
        impactoFinanciero:
          n.impactoFinanciero === 'CARGO_ARRENDATARIO'
            ? 'Cargo arrendatario'
            : n.impactoFinanciero === 'GASTO_INMOBILIARIA'
              ? 'Gasto inmobiliaria'
              : (n.impactoFinanciero ?? 'Pendiente'),
        montoAprobado: n.montoAprobado,
        gastoPagado: n.gastoPagado ? 'Sí' : 'No',
        responsableSugerido: n.responsableSugerido,
        aprobadoPorEmail: n.aprobadoPorEmail,
      });
    });

    sheet.getColumn('montoAprobado').numFmt = '$ #,##0';

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reporteNovedadesPorInmueble(novedades: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Novedades por inmueble');
    sheet.columns = [
      { header: 'Inmueble', key: 'inmueble', width: 32 },
      { header: 'Dirección', key: 'direccion', width: 38 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Tipo novedad', key: 'tipo', width: 22 },
      { header: 'Descripción', key: 'descripcion', width: 38 },
      { header: 'Valor', key: 'valor', width: 16 },
      { header: 'Responsable', key: 'responsable', width: 20 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Fecha', key: 'fecha', width: 16 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);
    novedades.forEach((n) =>
      sheet.addRow({
        inmueble: n.inmueble?.consecutivo ?? n.inmueble?.id,
        direccion: n.inmueble?.direccion,
        cliente: n.contrato?.cliente?.nombreCompleto ?? 'Sin contrato',
        tipo: n.impactoFinanciero,
        descripcion: n.descripcion,
        valor: n.montoAprobado,
        responsable: n.responsableSugerido,
        estado: n.estado,
        fecha: n.fecha,
      }),
    );
    sheet.getColumn('valor').numFmt = '$ #,##0';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reporteNovedadesFinanciero(novedades: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Novedades financieras');
    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 16 },
      { header: 'Inmueble', key: 'inmueble', width: 38 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Descripción', key: 'descripcion', width: 38 },
      { header: 'Valor', key: 'valor', width: 16 },
      { header: 'Responsable', key: 'responsable', width: 20 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Monto aprobado', key: 'montoAprobado', width: 18 },
      { header: 'Fecha pago', key: 'fechaPago', width: 16 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);
    novedades.forEach((n) =>
      sheet.addRow({
        fecha: n.fecha,
        inmueble: n.inmueble?.direccion,
        cliente: n.contrato?.cliente?.nombreCompleto ?? 'Sin contrato',
        descripcion: n.descripcion,
        valor: n.montoAprobado,
        responsable: n.impactoFinanciero,
        estado: n.estado,
        montoAprobado: n.montoAprobado,
        fechaPago: n.fechaPagoGasto,
      }),
    );
    sheet.getColumn('valor').numFmt = '$ #,##0';
    sheet.getColumn('montoAprobado').numFmt = '$ #,##0';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reporteGastosInmobiliaria(novedades: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Gastos inmobiliaria');
    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 16 },
      { header: 'Inmueble', key: 'inmueble', width: 38 },
      { header: 'Descripción', key: 'descripcion', width: 38 },
      { header: 'Valor', key: 'valor', width: 16 },
      { header: 'Medio pago', key: 'medioPago', width: 18 },
      { header: 'Referencia', key: 'referencia', width: 24 },
      { header: 'Estado', key: 'estado', width: 18 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);
    novedades.forEach((n) =>
      sheet.addRow({
        fecha: n.fecha,
        inmueble: n.inmueble?.direccion,
        descripcion: n.descripcion,
        valor: n.montoAprobado,
        medioPago: n.medioPagoGasto,
        referencia: n.referenciaPagoGasto,
        estado: n.gastoPagado ? 'PAGADO' : 'PENDIENTE_PAGO',
      }),
    );
    sheet.getColumn('valor').numFmt = '$ #,##0';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reporteNovedadesPendientes(novedades: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Novedades pendientes');
    sheet.columns = [
      { header: 'Fecha creación', key: 'fechaCreacion', width: 18 },
      { header: 'Inmueble', key: 'inmueble', width: 38 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Descripción', key: 'descripcion', width: 38 },
      { header: 'Valor', key: 'valor', width: 16 },
      { header: 'Días pendiente', key: 'diasPendiente', width: 16 },
      { header: 'Responsable sugerido', key: 'responsable', width: 22 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);
    const hoy = Date.now();
    novedades.forEach((n) =>
      sheet.addRow({
        fechaCreacion: n.creadoEn,
        inmueble: n.inmueble?.direccion,
        cliente: n.contrato?.cliente?.nombreCompleto ?? 'Sin contrato',
        descripcion: n.descripcion,
        valor: n.montoAprobado,
        diasPendiente: Math.max(0, Math.floor((hoy - new Date(n.creadoEn).getTime()) / 86_400_000)),
        responsable: n.responsableSugerido,
      }),
    );
    sheet.getColumn('valor').numFmt = '$ #,##0';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Reporte consolidado de cartera: obligaciones PENDIENTES/PARCIALES por contrato, con saldo
   * pendiente de capital (sin costo de mora / interés por retraso — retirado por decisión de
   * negocio el 2026-09-01). Incluye una fila de totales al final para el resumen gerencial.
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
      { header: 'Estado', key: 'estado', width: 14 },
    ];
    this.aplicarEstiloEncabezado(sheet, 1);

    let totalSaldo = 0;

    obligacionesPendientes.forEach((o) => {
      const saldoPendiente = o.valorOriginal - o.valorAbonado;
      totalSaldo += saldoPendiente;

      sheet.addRow({
        arrendatario: o.contrato?.cliente?.nombreCompleto,
        documento: o.contrato?.cliente?.numeroDocumento,
        inmueble: o.contrato?.inmueble?.direccion,
        barrio: o.contrato?.inmueble?.barrio,
        concepto: o.concepto,
        tipo: o.tipo,
        fechaVencimiento: o.fechaVencimiento,
        valorOriginal: o.valorOriginal,
        valorAbonado: o.valorAbonado,
        saldoPendiente,
        estado: o.estado,
      });
    });

    const filaTotales = sheet.addRow({
      arrendatario: 'TOTAL CARTERA',
      saldoPendiente: totalSaldo,
    });
    filaTotales.font = { bold: true };
    filaTotales.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    ['valorOriginal', 'valorAbonado', 'saldoPendiente'].forEach((key) => {
      sheet.getColumn(key).numFmt = '$ #,##0';
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

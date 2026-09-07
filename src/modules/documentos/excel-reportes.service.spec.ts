import * as ExcelJS from 'exceljs';
import { ExcelReportesService } from './excel-reportes.service';

/**
 * Unit test puro (sin base de datos): `ExcelReportesService` no tiene dependencias inyectadas,
 * así que se instancia directamente. Se lee el `.xlsx` generado con `exceljs` para verificar
 * encabezados y valores reales, en vez de solo comprobar que el buffer no esté vacío.
 */
describe('ExcelReportesService', () => {
  const service = new ExcelReportesService();

  async function leerHoja(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    return workbook.worksheets[0];
  }

  it('reporteContratos: genera un buffer .xlsx no vacío con una fila por contrato', async () => {
    const buffer = await service.reporteContratos([
      {
        id: 'c1',
        cliente: { nombreCompleto: 'Juan Pérez', numeroDocumento: '123' },
        inmueble: { direccion: 'Calle 1', barrio: 'Centro' },
        canonValor: 500000,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: null,
        estado: 'ACTIVO',
      },
    ]);

    expect(buffer.length).toBeGreaterThan(0);
    const sheet = await leerHoja(buffer);
    expect(sheet.getRow(1).getCell(2).value).toBe('Arrendatario'); // encabezado
    expect(sheet.getRow(2).getCell(2).value).toBe('Juan Pérez');
    expect(sheet.getRow(2).getCell(6).value).toBe(500000);
    expect(sheet.getRow(2).getCell(8).value).toBe('—'); // sin fecha fin
  });

  it('reportePorBarrio: ordena las filas alfabéticamente por barrio', async () => {
    const buffer = await service.reportePorBarrio([
      { direccion: 'Calle Z', barrio: 'Zona Norte', canonValor: 100000, estado: 'DISPONIBLE' },
      { direccion: 'Calle A', barrio: 'Alameda', canonValor: 200000, estado: 'OCUPADO' },
    ]);

    const sheet = await leerHoja(buffer);
    expect(sheet.getRow(2).getCell(2).value).toBe('Alameda');
    expect(sheet.getRow(3).getCell(2).value).toBe('Zona Norte');
  });

  it('reporteCartera: la fila de totales suma correctamente el saldo pendiente de todas las filas', async () => {
    const buffer = await service.reporteCartera([
      {
        contrato: { cliente: { nombreCompleto: 'A', numeroDocumento: '1' }, inmueble: { direccion: 'X', barrio: 'Y' } },
        concepto: 'Canon',
        tipo: 'CANON',
        fechaVencimiento: new Date(),
        valorOriginal: 500000,
        valorAbonado: 200000,
        estado: 'PARCIAL',
      },
      {
        contrato: {
          cliente: { nombreCompleto: 'B', numeroDocumento: '2' },
          inmueble: { direccion: 'X2', barrio: 'Y2' },
        },
        concepto: 'Novedad',
        tipo: 'NOVEDAD',
        fechaVencimiento: new Date(),
        valorOriginal: 100000,
        valorAbonado: 0,
        estado: 'PENDIENTE',
      },
    ]);

    const sheet = await leerHoja(buffer);
    // Fila 4 = totales (encabezado=1, dos obligaciones=2,3)
    const filaTotales = sheet.getRow(4);
    expect(filaTotales.getCell(1).value).toBe('TOTAL CARTERA');
    // Columna 10 = "Saldo pendiente" (ya no hay columna "Mora acumulada").
    expect(filaTotales.getCell(10).value).toBe(400000); // (500000-200000) + (100000-0)
  });

  it('reporteRecaudo: refleja valorTotal y excedente como números, distingue el tipo de documento y totaliza el recaudo neto', async () => {
    const buffer = await service.reporteRecaudo([
      {
        consecutivo: 'REC-000001',
        creadoEn: new Date(),
        contrato: { cliente: { nombreCompleto: 'C' }, inmueble: { direccion: 'X', barrio: 'Y' } },
        valorTotal: 550000,
        excedente: 50000,
        excedenteComoSaldoFavor: false,
        esLiquidacionDeposito: false,
        estado: 'EMITIDO',
      },
      {
        consecutivo: 'REC-000002',
        creadoEn: new Date(),
        contrato: { cliente: { nombreCompleto: 'D' }, inmueble: { direccion: 'X2', barrio: 'Y2' } },
        valorTotal: 300000,
        excedente: 0,
        excedenteComoSaldoFavor: false,
        esLiquidacionDeposito: true,
        estado: 'EMITIDO',
      },
    ]);

    const sheet = await leerHoja(buffer);
    expect(sheet.getRow(2).getCell(6).value).toBe('Pago');
    expect(sheet.getRow(2).getCell(7).value).toBe(550000);
    expect(sheet.getRow(2).getCell(8).value).toBe(50000);
    expect(sheet.getRow(3).getCell(6).value).toBe('Liquidación depósito');
    // Fila 4 = totales: solo el recibo EMITIDO que no es liquidación, menos el cambio devuelto.
    expect(sheet.getRow(4).getCell(7).value).toBe(500000); // 550000 - 50000
  });
});

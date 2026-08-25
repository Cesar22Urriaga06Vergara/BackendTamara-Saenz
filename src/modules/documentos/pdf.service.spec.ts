import { PdfReciboService } from './pdf-recibo.service';
import { PdfNovedadService } from './pdf-novedad.service';
import { EstadoRecibo } from '../recaudo/entities/recibo-caja.entity';
import { ConceptoAplicacion } from '../recaudo/entities/aplicacion-pago.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';

/**
 * Unit test puro (sin base de datos, sin logo en disco): ninguno de los dos servicios tiene
 * dependencias inyectadas. El objetivo es un smoke test de regresión — que la plantilla
 * completa (incluida la tabla de aplicación, RECAUDO-03) renderice sin lanzar, tanto para un
 * recibo EMITIDO como uno ANULADO (rama de código distinta dentro del mismo método).
 */
describe('Generación de PDF (documentos)', () => {
  const empresaFake = {
    nombre: 'Empresa de Pruebas',
    nit: '900000000-1',
    slogan: 'Resolvemos tu situación',
    direccion: 'Calle Falsa 123',
    telefono: '3000000000',
    logoUrl: null as any,
  };

  function reciboFake(overrides: Record<string, any> = {}) {
    return {
      id: 'r1',
      consecutivo: 'REC-000001',
      creadoEn: new Date('2026-08-20'),
      estado: EstadoRecibo.EMITIDO,
      valorTotal: 550000,
      excedente: 50000,
      excedenteComoSaldoFavor: false,
      motivoAnulacion: null,
      contrato: {
        cliente: { nombreCompleto: 'Juan Pérez', numeroDocumento: '123456789' },
        inmueble: { direccion: 'Calle 1 # 2-3', barrio: 'Centro' },
      },
      detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 550000, referencia: null }],
      aplicaciones: [
        {
          concepto: ConceptoAplicacion.CAPITAL,
          montoAplicado: 500000,
          saldoPosterior: 0,
          obligacion: { concepto: 'Canon Agosto 2026', periodo: '2026-08-01' },
        },
      ],
      ...overrides,
    } as any;
  }

  it('PdfReciboService: genera un PDF válido para un recibo EMITIDO con tabla de aplicación', async () => {
    const service = new PdfReciboService();
    const buffer = await service.generar(reciboFake(), empresaFake, 'CARTA');

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('PdfReciboService: genera un PDF válido en formato MEDIA_CARTA', async () => {
    const service = new PdfReciboService();
    const buffer = await service.generar(reciboFake(), empresaFake, 'MEDIA_CARTA');

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('PdfReciboService: genera un PDF válido para un recibo ANULADO (rama distinta del template)', async () => {
    const service = new PdfReciboService();
    const buffer = await service.generar(
      reciboFake({ estado: EstadoRecibo.ANULADO, motivoAnulacion: 'Error de digitación', aplicaciones: [] }),
      empresaFake,
      'CARTA',
    );

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('PdfReciboService: genera un PDF válido sin aplicaciones (recibo antiguo, RECAUDO-03)', async () => {
    const service = new PdfReciboService();
    const buffer = await service.generar(reciboFake({ aplicaciones: [] }), empresaFake, 'CARTA');

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('PdfNovedadService: genera un PDF válido para una novedad', async () => {
    const service = new PdfNovedadService();
    const novedadFake = {
      consecutivo: 'NOV-000001',
      descripcion: 'Fuga de agua en el baño principal',
      fecha: new Date('2026-08-20'),
      observaciones: null,
      responsableSugerido: 'INMOBILIARIA',
      estado: 'ABIERTA',
      inmueble: { direccion: 'Calle 1 # 2-3', barrio: 'Centro' },
      contrato: null,
    } as any;

    const buffer = await service.generar(novedadFake, empresaFake);

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});

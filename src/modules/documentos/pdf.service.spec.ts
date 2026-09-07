import * as zlib from 'zlib';
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
  /**
   * PDFKit (a) comprime cada content stream con Flate por defecto, y (b) incluso ya descomprimido,
   * escribe el texto como hex strings dentro de operadores `Tj`/`TJ` — un `TJ` además intercala
   * números de kerning entre los `<hex>` de una misma frase cuando el par de glifos lo amerita
   * (ej. "Documento generado" queda como `[<...> -25 <...> ...] TJ`, partido a mitad de palabra).
   * Buscar un string literal en `buffer.toString('latin1')` directamente NUNCA lo encuentra —
   * un `expect(...).not.toContain(...)` "pasaría" aunque el texto se hubiera renderizado mal
   * (falso positivo). Para verificar contenido real: se descomprime cada `stream...endstream`,
   * se extrae cada token `<hex>` en orden (ignorando los números de kerning, que no son
   * caracteres) y se concatenan sus bytes — reconstruye el texto tal como se ve en el PDF.
   */
  function textoPlano(buffer: Buffer): string {
    const marcadorInicio = Buffer.from('stream');
    const marcadorFin = Buffer.from('endstream');
    const inflados: Buffer[] = [];
    let desde = 0;
    for (;;) {
      const i = buffer.indexOf(marcadorInicio, desde);
      if (i === -1) break;
      let inicioDatos = i + marcadorInicio.length;
      if (buffer[inicioDatos] === 0x0d) inicioDatos++;
      if (buffer[inicioDatos] === 0x0a) inicioDatos++;
      const j = buffer.indexOf(marcadorFin, inicioDatos);
      if (j === -1) break;
      try {
        inflados.push(zlib.inflateSync(buffer.subarray(inicioDatos, j)));
      } catch {
        // No era Flate (ej. un font program embebido) — se ignora, no aporta texto.
      }
      desde = j + marcadorFin.length;
    }

    const partes: Buffer[] = [];
    const regexHex = /<([0-9A-Fa-f]+)>/g;
    for (const inflado of inflados) {
      const texto = inflado.toString('latin1');
      regexHex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regexHex.exec(texto))) {
        partes.push(Buffer.from(m[1], 'hex'));
      }
    }
    return Buffer.concat(partes).toString('latin1');
  }

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

  function novedadFake(overrides: Record<string, any> = {}) {
    return {
      consecutivo: 'NOV-000001',
      descripcion: 'Fuga de agua en el baño principal',
      fecha: new Date('2026-08-20'),
      observaciones: null,
      responsableSugerido: 'INMOBILIARIA',
      estado: 'ABIERTA',
      impactoFinanciero: 'PENDIENTE',
      montoAprobado: null,
      aprobadoPorEmail: null,
      gastoPagado: false,
      medioPagoGasto: null,
      referenciaPagoGasto: null,
      fechaPagoGasto: null,
      pagadoPorEmail: null,
      registradoPorEmail: 'admin@tamarasaenz.com',
      inmueble: { direccion: 'Calle 1 # 2-3', barrio: 'Centro' },
      contrato: null,
      ...overrides,
    } as any;
  }

  it('PdfNovedadService: genera un PDF válido para una novedad sin contrato asociado', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(novedadFake(), empresaFake);

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('PdfNovedadService: identifica el contrato por cliente, nunca por su UUID interno', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(
      novedadFake({
        observaciones: 'El cliente reportó el daño hace 3 días.',
        contrato: {
          id: 'c9f2a5b0-1234-4a1b-9c3d-abcdef123456',
          fechaInicio: '2025-01-15',
          cliente: { nombreCompleto: 'Paula Andrea Sánchez Moreno' },
        },
      }),
      empresaFake,
    );

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    const contenido = textoPlano(buffer);
    expect(contenido).not.toContain('c9f2a5b0-1234-4a1b-9c3d-abcdef123456');
    expect(contenido).toContain('Paula Andrea Sánchez Moreno');
  });

  it('PdfNovedadService: genera un PDF válido para una novedad ANULADA (banner distinto del template)', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(novedadFake({ estado: 'ANULADA' }), empresaFake);

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('PdfNovedadService: genera un PDF válido para cada estado y con observaciones', async () => {
    const service = new PdfNovedadService();
    for (const estado of ['ABIERTA', 'EN_SEGUIMIENTO', 'CERRADA', 'ANULADA']) {
      const buffer = await service.generar(
        novedadFake({ estado, observaciones: 'Observación de prueba.' }),
        empresaFake,
      );
      expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    }
  });

  it('PdfNovedadService: una novedad PENDIENTE no declara monto (aún no hay costo real que mostrar)', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(novedadFake(), empresaFake);

    const contenido = textoPlano(buffer);
    expect(contenido).toContain('Pendiente de aprobación financiera');
    expect(contenido).not.toContain('Monto:');
  });

  it('PdfNovedadService: declara el monto aprobado y quien aprobo para un cargo al arrendatario', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(
      novedadFake({
        impactoFinanciero: 'CARGO_ARRENDATARIO',
        montoAprobado: 350000,
        aprobadoPorEmail: 'admin@tamarasaenz.com',
      }),
      empresaFake,
    );

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    const contenido = textoPlano(buffer);
    expect(contenido).toContain('Cargo al arrendatario');
    expect(contenido).toContain('Monto:');
    // No es GASTO_INMOBILIARIA: no debe aparecer estado de pago (ese campo solo aplica a gastos).
    expect(contenido).not.toContain('Estado de pago:');
  });

  it('PdfNovedadService: declara medio de pago, referencia y quien pago un gasto de inmobiliaria ya pagado', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(
      novedadFake({
        impactoFinanciero: 'GASTO_INMOBILIARIA',
        montoAprobado: 120000,
        aprobadoPorEmail: 'admin@tamarasaenz.com',
        gastoPagado: true,
        medioPagoGasto: MedioPago.TRANSFERENCIA,
        referenciaPagoGasto: 'TRX-998877',
        fechaPagoGasto: new Date('2026-08-22'),
        pagadoPorEmail: 'admin@tamarasaenz.com',
      }),
      empresaFake,
    );

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    const contenido = textoPlano(buffer);
    expect(contenido).toContain('Gasto de la inmobiliaria');
    expect(contenido).toContain('Pagado');
    expect(contenido).toContain('TRX-998877');
  });

  it('PdfNovedadService: un gasto de inmobiliaria aprobado pero sin pagar muestra "Pendiente de pago", sin datos de pago', async () => {
    const service = new PdfNovedadService();
    const buffer = await service.generar(
      novedadFake({
        impactoFinanciero: 'GASTO_INMOBILIARIA',
        montoAprobado: 80000,
        aprobadoPorEmail: 'admin@tamarasaenz.com',
        gastoPagado: false,
      }),
      empresaFake,
    );

    const contenido = textoPlano(buffer);
    expect(contenido).toContain('Pendiente de pago');
    expect(contenido).not.toContain('Medio de pago:');
  });
});

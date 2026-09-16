import { ServiciosPublicosService } from './servicios-publicos.service';
import { TipoServicioPublico, ResponsablePago, EstadoPagoServicio } from './entities/recibo-publico.entity';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  TestApp,
  crearInmueble,
  obtenerOCrearPropietarioInmobiliaria,
} from '../../../test/test-app';

describe('ServiciosPublicosService (integración)', () => {
  let testApp: TestApp;
  let service: ServiciosPublicosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ServiciosPublicosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('crea un recibo público y aprueba el responsable de pago', async () => {
    const propietario = await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, {
      propietario,
      codigoEnergia: 'E-1001',
      codigoAgua: 'A-1001',
      codigoGas: 'G-1001',
    });

    const creado = await service.crear(
      {
        inmuebleId: inmueble.id,
        tipoServicio: TipoServicioPublico.LUZ,
        periodo: '2026-09',
        numeroFactura: 'LUZ-2026-09-001',
        valor: 125000,
        fechaEmision: '2026-09-01',
        fechaVencimiento: '2026-09-15',
        observaciones: 'Recibo de prueba',
      },
      'recepcion@tamarasaenz.com',
    );

    expect(creado.responsablePago).toBe(ResponsablePago.PENDIENTE);
    expect(creado.estadoPago).toBe(EstadoPagoServicio.PENDIENTE);

    await service.aprobarResponsable(
      creado.id,
      { responsablePago: ResponsablePago.ARRENDATARIO },
      'admin@tamarasaenz.com',
    );

    const actualizado = await service.obtener(creado.id);
    expect(actualizado.responsablePago).toBe(ResponsablePago.ARRENDATARIO);
    expect(actualizado.aprobadoPorEmail).toBe('admin@tamarasaenz.com');
  });

  it('rechaza un recibo para un inmueble inexistente', async () => {
    await expect(
      service.crear(
        {
          inmuebleId: '00000000-0000-4000-8000-000000000000',
          tipoServicio: TipoServicioPublico.AGUA,
          periodo: '2026-09',
          numeroFactura: 'AGUA-2026-09-ERR',
          valor: 50000,
          fechaEmision: '2026-09-01',
          fechaVencimiento: '2026-09-20',
        },
        'recepcion@tamarasaenz.com',
      ),
    ).rejects.toThrow('Inmueble no encontrado.');
  });

  it('filtra los recibos por tipo de servicio', async () => {
    const inmueble = await crearInmueble(testApp.dataSource);
    await service.crear(
      {
        inmuebleId: inmueble.id,
        tipoServicio: TipoServicioPublico.LUZ,
        periodo: '2026-09',
        numeroFactura: 'LUZ-FILTRO',
        valor: 100000,
        fechaEmision: '2026-09-01',
        fechaVencimiento: '2026-09-15',
      },
      'recepcion@tamarasaenz.com',
    );
    await service.crear(
      {
        inmuebleId: inmueble.id,
        tipoServicio: TipoServicioPublico.AGUA,
        periodo: '2026-09',
        numeroFactura: 'AGUA-FILTRO',
        valor: 50000,
        fechaEmision: '2026-09-01',
        fechaVencimiento: '2026-09-15',
      },
      'recepcion@tamarasaenz.com',
    );

    const resultado = await service.listar({ page: 1, limit: 10, tipoServicio: TipoServicioPublico.LUZ });

    expect(resultado.total).toBe(1);
    expect(resultado.data[0].tipoServicio).toBe(TipoServicioPublico.LUZ);
  });
});

import { ObligacionesService } from './obligaciones.service';
import { Obligacion, TipoObligacion, EstadoObligacion } from './entities/obligacion.entity';
import { hoyNegocioISO } from '../../common/utils/fecha.util';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  TestApp,
} from '../../../test/test-app';

/**
 * Plan 022 — DATA-2: el veredicto de "vencida" tiene que ser el MISMO lo calcule la app (JS,
 * `esVencida()`) o la base de datos (SQL, `condicionCarteraVencida` vía `todasPendientes()`).
 * Antes discrepaban un día en la franja nocturna colombiana porque la query usaba la función
 * "hoy" de MySQL (TZ de la sesión) y la app `new Date()` (TZ del proceso). Ahora ambas derivan
 * del mismo día calendario de Bogotá (`hoyNegocioISO()`, vía `Intl` — independiente del TZ del
 * proceso, así que este test vale en cualquier `TZ` con el que se lance la suite).
 */
describe('Vencimiento — coherencia JS ↔ SQL (plan 022)', () => {
  let testApp: TestApp;
  let service: ObligacionesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ObligacionesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function isoMasDias(dias: number): string {
    const [a, m, d] = hoyNegocioISO().split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
  }

  async function crearObligacionVenc(contratoId: string, fechaVencimiento: string): Promise<Obligacion> {
    const repo = testApp.dataSource.getRepository(Obligacion);
    return repo.save(
      repo.create({
        contrato: { id: contratoId } as never,
        tipo: TipoObligacion.CANON,
        concepto: `Canon venc ${fechaVencimiento}`,
        periodo: fechaVencimiento,
        fechaVencimiento,
        valorOriginal: 500000,
        estado: EstadoObligacion.PENDIENTE,
      }),
    );
  }

  it('en la frontera hoy/mañana, esVencida() y la query de cartera vencida coinciden', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 500000 });

    const hoy = await crearObligacionVenc(contrato.id, isoMasDias(0)); // vence HOY (Bogotá)
    const manana = await crearObligacionVenc(contrato.id, isoMasDias(1)); // vence MAÑANA

    const idsVencidasSql = new Set((await service.todasPendientes()).map((o) => o.id));

    const veredicto = {
      hoyJs: service.esVencida(hoy.fechaVencimiento),
      hoySql: idsVencidasSql.has(hoy.id),
      mananaJs: service.esVencida(manana.fechaVencimiento),
      mananaSql: idsVencidasSql.has(manana.id),
    };

    expect(veredicto).toEqual({ hoyJs: true, hoySql: true, mananaJs: false, mananaSql: false });
  });
});

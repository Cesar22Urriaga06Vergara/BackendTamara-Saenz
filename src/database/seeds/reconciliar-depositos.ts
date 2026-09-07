import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { Contrato } from '../../modules/contratos/entities/contrato.entity';
import { Movimiento, OrigenMovimiento, TipoMovimiento } from '../../modules/movimientos/entities/movimiento.entity';

/**
 * Reconciliación puntual del hallazgo B5 de la auditoría contable (2026-09-01).
 *
 * Hasta esa fecha, recibir un depósito de garantía (`Contrato.depositoGarantia`) NO generaba
 * ningún `Movimiento` de INGRESO — pero su devolución al liquidar SÍ genera un EGRESO. En la
 * BD real, todos los contratos creados antes de la corrección tienen depósito registrado sin
 * su ingreso, así que `caja/saldo-esperado` está subestimado por la suma de esos depósitos.
 *
 * Este script busca los contratos con `depositoGarantia > 0` que NO tienen un `Movimiento`
 * INGRESO de origen DEPOSITO, y crea el ingreso faltante — con `medioPago = null` ("pendiente
 * de identificar", como el sistema ya trata otros movimientos sin medio conocido: NOV-01/DEP-01).
 *
 * ⚠️ POR DEFECTO SOLO LISTA (dry-run). Opera sobre la BD apuntada por `.env` (datos reales).
 * Revisar el listado con el dueño ANTES de correr con `--aplicar`.
 *
 *   npx ts-node src/database/seeds/reconciliar-depositos.ts            → solo lista
 *   npx ts-node src/database/seeds/reconciliar-depositos.ts --aplicar  → crea los ingresos
 */
async function reconciliar() {
  const aplicar = process.argv.includes('--aplicar');
  const ds = await AppDataSource.initialize();

  const contratoRepo = ds.getRepository(Contrato);
  const movimientoRepo = ds.getRepository(Movimiento);

  const contratosConDeposito = await contratoRepo
    .createQueryBuilder('c')
    .leftJoinAndSelect('c.cliente', 'cliente')
    .where('c.depositoGarantia > 0')
    .getMany();

  const pendientes: Contrato[] = [];
  for (const contrato of contratosConDeposito) {
    const yaTieneIngreso = await movimientoRepo.findOne({
      where: {
        contratoId: contrato.id,
        origen: OrigenMovimiento.DEPOSITO,
        tipo: TipoMovimiento.INGRESO,
      },
    });
    if (!yaTieneIngreso) pendientes.push(contrato);
  }

  console.log(`\n${contratosConDeposito.length} contrato(s) con depósito de garantía > 0.`);
  console.log(`${pendientes.length} sin su Movimiento INGRESO de origen DEPOSITO:\n`);
  let total = 0;
  for (const c of pendientes) {
    total += Number(c.depositoGarantia);
    console.log(
      `  - contrato ${c.id}  (${(c as any).cliente?.nombreCompleto ?? 'sin cliente'})  ` +
        `→ INGRESO $${Number(c.depositoGarantia).toLocaleString('es-CO')}`,
    );
  }
  console.log(`\n  TOTAL a ingresar: $${total.toLocaleString('es-CO')}`);

  if (!aplicar) {
    console.log('\n(dry-run) No se escribió nada. Corre con `--aplicar` para crear los ingresos.\n');
    await ds.destroy();
    return;
  }

  // Los movimientos INGRESO no llevan consecutivo (solo los EGRESO — ver MovimientosService).
  await ds.transaction(async (manager) => {
    for (const contrato of pendientes) {
      await manager.getRepository(Movimiento).save(
        manager.getRepository(Movimiento).create({
          tipo: TipoMovimiento.INGRESO,
          origen: OrigenMovimiento.DEPOSITO,
          consecutivo: null,
          concepto: `Depósito de garantía recibido — contrato ${contrato.id} (reconciliación B5)`,
          monto: contrato.depositoGarantia,
          registradoPorEmail: 'reconciliacion-b5@sistema',
          contratoId: contrato.id,
          medioPago: null,
          referencia: null,
          esReverso: false,
          movimientoOriginalId: null,
        }),
      );
    }
  });

  console.log(`\n✅ ${pendientes.length} ingreso(s) de depósito creados.\n`);
  await ds.destroy();
}

reconciliar().catch((err) => {
  console.error('❌ Error en la reconciliación:', err);
  process.exit(1);
});

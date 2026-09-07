import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { seedDemo } from './seed-demo';

/**
 * Reinicia la base de datos a un estado LIMPIO y (por defecto) la re-puebla con el dataset
 * de demostración.
 *
 *  - CONSERVA: usuarios, empresa, consecutivos (reiniciados a 0), el propietario especial
 *    "INMOBILIARIA" y la tabla `migrations` (estado del esquema).
 *  - BORRA: contratos, obligaciones, recibos, movimientos, novedades, clientes, codeudores,
 *    inmuebles, propietarios externos, arqueos, saldo a favor, descuentos, recibos, auditoría
 *    y sesiones (refresh tokens).
 *  - Luego corre `seed-demo.ts` (10 contratos con fechaInicio entre el 15 y el 24 de julio de
 *    2026), salvo que se pase `--vacio`.
 *
 * Uso:
 *   npm run seed:reset            → limpia y re-puebla el demo
 *   npm run seed:reset -- --vacio → solo limpia (deja la BD sin datos operativos)
 *
 * Requiere que `npm run seed` (empresa + consecutivos + usuarios) haya corrido alguna vez.
 * ⚠️ Opera sobre la BD apuntada por `.env` (`DB_DATABASE`). Es destructivo e irreversible.
 */

/** Tablas operativas a vaciar por completo, en orden seguro respecto de las FKs. */
const TABLAS_A_VACIAR = [
  'refresh_token',
  'aplicacion_pago',
  'detalle_pago',
  'saldo_favor_credito',
  'descuento_deposito',
  'recibo_caja',
  'arqueo_caja',
  'movimiento',
  'obligacion',
  'novedad',
  'contrato_codeudores',
  'contrato_historial_estado',
  'contrato',
  'codeudor',
  'cliente',
  'inmueble',
  'registro_auditoria',
];

async function contar(ds: import('typeorm').DataSource, tabla: string): Promise<number> {
  const filas = await ds.query(`SELECT COUNT(*) AS c FROM \`${tabla}\``);
  return Number(filas[0]?.c ?? 0);
}

async function reset() {
  const soloVaciar = process.argv.includes('--vacio');
  const ds = await AppDataSource.initialize();

  // Guarda de seguridad mínima: la base operativa tiene que existir.
  if ((await contar(ds, 'empresa')) === 0 || (await contar(ds, 'usuario')) === 0) {
    throw new Error('No hay empresa/usuarios. Corre `npm run seed` antes de `npm run seed:reset`.');
  }

  console.log(`🧹 Limpiando la BD \`${process.env.DB_DATABASE}\`...`);
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of TABLAS_A_VACIAR) {
    await ds.query(`TRUNCATE TABLE \`${tabla}\``);
    console.log(`  🗑️  ${tabla}`);
  }
  // `propietario` NO se trunca: se conserva el registro semilla "INMOBILIARIA" (creado por
  // migración, requerido por todo inmueble).
  await ds.query('DELETE FROM `propietario` WHERE `esInmobiliaria` = 0');
  console.log('  🗑️  propietario (externos; INMOBILIARIA conservada)');
  await ds.query('SET FOREIGN_KEY_CHECKS = 1');

  // Los consecutivos de documentos vuelven a 0 (todos los recibos/egresos/etc. se borraron).
  await ds.query('UPDATE `consecutivo` SET `ultimoNumero` = 0');
  console.log('🔄 Consecutivos de documentos reiniciados a 0');

  console.log(
    `✅ Conservado: ${await contar(ds, 'usuario')} usuario(s), ${await contar(ds, 'empresa')} empresa, ` +
      `${await contar(ds, 'consecutivo')} consecutivo(s), ${await contar(ds, 'propietario')} propietario (INMOBILIARIA).`,
  );

  await ds.destroy();

  if (soloVaciar) {
    console.log('\n🌱 BD vaciada (sin re-poblar demo). Listo.');
    return;
  }

  console.log('\n🌱 Re-poblando el dataset de demostración...\n');
  await seedDemo();
}

reset().catch((err) => {
  console.error('❌ Error en el reset:', err);
  process.exit(1);
});

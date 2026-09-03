import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { Propietario } from '../../modules/propietarios/entities/propietario.entity';
import { Cliente } from '../../modules/personas/entities/cliente.entity';
import { Codeudor } from '../../modules/personas/entities/codeudor.entity';
import { Inmueble, EstadoInmueble } from '../../modules/inmuebles/entities/inmueble.entity';
import { Contrato, EstadoContrato } from '../../modules/contratos/entities/contrato.entity';
import { Consecutivo } from '../../modules/empresa/entities/consecutivo.entity';
import { Empresa } from '../../modules/empresa/entities/empresa.entity';
import { Obligacion, TipoObligacion, EstadoObligacion } from '../../modules/obligaciones/entities/obligacion.entity';
import { fechaLocalDesdeString } from '../../common/utils/fecha.util';

/**
 * Script de datos de DEMOSTRACIÓN (no confundir con `seed.ts`, que puebla lo mínimo
 * operativo: empresa, consecutivos y usuarios). Este crea un universo de prueba para
 * explorar el flujo de contratación:
 *  - 2 Propietarios adicionales (además de "INMOBILIARIA"), para variar dueños de inmueble.
 *  - 10 Clientes.
 *  - 7 Codeudores, deliberadamente reutilizados en más de un contrato/cliente distinto,
 *    para probar la relación N:M Contrato-Codeudor (ver `contrato_codeudores`).
 *  - 10 Inmuebles repartidos entre los 3 propietarios.
 *  - 10 Contratos (uno por inmueble/cliente), todos ACTIVO, con `fechaInicio` entre el 15 y el
 *    25 de julio de 2026 (un día distinto cada uno), y con el canon generado desde esa fecha
 *    hasta el horizonte futuro — así la cartera y el recaudo quedan con datos realistas que
 *    probar (uno o dos meses de canon vencido por contrato, no un año).
 *
 * Idempotente: puede ejecutarse varias veces sin duplicar filas (busca por documento/
 * dirección antes de crear). Ejecutar DESPUÉS de `npm run seed`:
 *   npm run seed:demo
 * o, para partir de una base limpia:
 *   npm run seed:reset
 */

const PROPIETARIOS_DATA = [
  {
    nombre: 'Familia Gómez Restrepo',
    numeroDocumento: '63456789',
    telefono: '3104567890',
    email: 'gomezrestrepo.propiedades@gmail.com',
  },
  {
    nombre: 'Inversiones El Roble S.A.S.',
    numeroDocumento: '900123456-7',
    telefono: '6076543210',
    email: 'contacto@elroblesas.com',
  },
];

const CLIENTES_DATA = [
  {
    numeroDocumento: '1020345678',
    nombreCompleto: 'Laura Vanessa Martínez Cárdenas',
    email: 'laura.martinez@gmail.com',
    telefono: '3011234567',
    direccion: 'Calle 45 #12-30',
  },
  {
    numeroDocumento: '1032456789',
    nombreCompleto: 'Andrés Felipe Gómez Salazar',
    email: 'andres.gomez@gmail.com',
    telefono: '3022345678',
    direccion: 'Carrera 20 #34-15',
  },
  {
    numeroDocumento: '52789456',
    nombreCompleto: 'Diana Carolina Rojas Peña',
    email: 'diana.rojas@hotmail.com',
    telefono: '3033456789',
    direccion: 'Calle 78 #9-42',
  },
  {
    numeroDocumento: '80123456',
    nombreCompleto: 'Juan Sebastián Castro Duarte',
    email: 'juan.castro@gmail.com',
    telefono: '3044567890',
    direccion: 'Carrera 15 #67-21',
  },
  {
    numeroDocumento: '1015678234',
    nombreCompleto: 'María José Herrera Vargas',
    email: 'mariajose.herrera@gmail.com',
    telefono: '3055678901',
    direccion: 'Calle 33 #18-56',
  },
  {
    numeroDocumento: '79456123',
    nombreCompleto: 'Camilo Andrés Torres Ríos',
    email: 'camilo.torres@hotmail.com',
    telefono: '3066789012',
    direccion: 'Carrera 8 #45-10',
  },
  {
    numeroDocumento: '1018234567',
    nombreCompleto: 'Paula Andrea Sánchez Moreno',
    email: 'paula.sanchez@gmail.com',
    telefono: '3077890123',
    direccion: 'Calle 12 #23-67',
  },
  {
    numeroDocumento: '71345678',
    nombreCompleto: 'Jorge Iván Ramírez Ospina',
    email: 'jorge.ramirez@gmail.com',
    telefono: '3088901234',
    direccion: 'Carrera 30 #56-89',
  },
  {
    numeroDocumento: '1023456781',
    nombreCompleto: 'Natalia Andrea Pérez Londoño',
    email: 'natalia.perez@gmail.com',
    telefono: '3099012345',
    direccion: 'Calle 67 #14-25',
  },
  {
    numeroDocumento: '1101234567',
    nombreCompleto: 'Miguel Ángel Fonseca Bautista',
    email: 'miguel.fonseca@gmail.com',
    telefono: '3100123456',
    direccion: 'Carrera 22 #78-33',
  },
];

const CODEUDORES_DATA = [
  {
    numeroDocumento: '19456789',
    nombreCompleto: 'Carlos Alberto Muñoz Díaz',
    email: 'carlos.munoz@gmail.com',
    telefono: '3151234567',
    direccion: 'Calle 50 #10-20',
  },
  {
    numeroDocumento: '43678912',
    nombreCompleto: 'Sandra Milena León Bravo',
    email: 'sandra.leon@gmail.com',
    telefono: '3152345678',
    direccion: 'Carrera 25 #40-11',
  },
  {
    numeroDocumento: '91234567',
    nombreCompleto: 'Rodrigo Esteban Villamizar',
    email: 'rodrigo.villamizar@hotmail.com',
    telefono: '3153456789',
    direccion: 'Calle 80 #22-45',
  },
  {
    numeroDocumento: '52345678',
    nombreCompleto: 'Adriana Lucía Cifuentes',
    email: 'adriana.cifuentes@gmail.com',
    telefono: '3154567890',
    direccion: 'Carrera 18 #33-27',
  },
  {
    numeroDocumento: '79876543',
    nombreCompleto: 'Fernando José Restrepo',
    email: 'fernando.restrepo@gmail.com',
    telefono: '3155678901',
    direccion: 'Calle 15 #60-14',
  },
  {
    numeroDocumento: '41234567',
    nombreCompleto: 'Gloria Patricia Nieto',
    email: 'gloria.nieto@hotmail.com',
    telefono: '3156789012',
    direccion: 'Carrera 40 #19-38',
  },
  {
    numeroDocumento: '19876543',
    nombreCompleto: 'Hernán Darío Salcedo',
    email: 'hernan.salcedo@gmail.com',
    telefono: '3157890123',
    direccion: 'Calle 90 #27-52',
  },
];

// índice de propietario: -1 = INMOBILIARIA (default), 0/1 = PROPIETARIOS_DATA[i]
const INMUEBLES_DATA = [
  {
    propietario: -1,
    direccion: 'Calle 45 #12-30 Apto 301',
    barrio: 'El Prado',
    canonValor: 1200000,
    depositoValor: 1200000,
  },
  {
    propietario: -1,
    direccion: 'Carrera 20 #34-15 Casa 2',
    barrio: 'Cabecera',
    canonValor: 1800000,
    depositoValor: 1800000,
  },
  { propietario: -1, direccion: 'Calle 78 #9-42', barrio: 'La Aurora', canonValor: 950000, depositoValor: 950000 },
  {
    propietario: 0,
    direccion: 'Carrera 15 #67-21 Apto 502',
    barrio: 'Provenza',
    canonValor: 2200000,
    depositoValor: 2200000,
  },
  {
    propietario: 0,
    direccion: 'Calle 33 #18-56',
    barrio: 'Ciudadela Real de Minas',
    canonValor: 1100000,
    depositoValor: 1100000,
  },
  {
    propietario: 0,
    direccion: 'Carrera 8 #45-10 Local 1',
    barrio: 'San Alonso',
    canonValor: 1500000,
    depositoValor: 1500000,
  },
  {
    propietario: 1,
    direccion: 'Calle 12 #23-67 Apto 101',
    barrio: 'Álvarez',
    canonValor: 1300000,
    depositoValor: 1300000,
  },
  { propietario: 1, direccion: 'Carrera 30 #56-89', barrio: 'El Bosque', canonValor: 1650000, depositoValor: 1650000 },
  {
    propietario: 1,
    direccion: 'Calle 67 #14-25 Casa',
    barrio: 'La Victoria',
    canonValor: 900000,
    depositoValor: 900000,
  },
  {
    propietario: -1,
    direccion: 'Carrera 22 #78-33 Apto 604',
    barrio: 'Mutis',
    canonValor: 1750000,
    depositoValor: 1750000,
  },
];

// índices sobre CLIENTES_DATA/INMUEBLES_DATA (0-based) + codeudores (índices sobre CODEUDORES_DATA).
// El codeudor 0 se repite en los contratos 0 y 1 (dos clientes distintos); el 2 en 2 y 3;
// el 4 en 4 y 5; el 6 y el 1 se repiten en el contrato 8 — así se cubre el caso "mismo
// codeudor ligado a más de un cliente" pedido explícitamente.
// Todos los contratos arrancan en julio de 2026 (día 15 a 24); `diaPago` = día de la fecha de
// inicio, para que el primer canon venza exactamente ese día.
const CONTRATOS_DATA = [
  { cliente: 0, inmueble: 0, codeudores: [0], fechaInicio: '2026-07-15', diaPago: 15 },
  { cliente: 1, inmueble: 1, codeudores: [0, 1], fechaInicio: '2026-07-16', diaPago: 16 },
  { cliente: 2, inmueble: 2, codeudores: [2], fechaInicio: '2026-07-17', diaPago: 17 },
  { cliente: 3, inmueble: 3, codeudores: [2, 3], fechaInicio: '2026-07-18', diaPago: 18 },
  { cliente: 4, inmueble: 4, codeudores: [4], fechaInicio: '2026-07-19', diaPago: 19 },
  { cliente: 5, inmueble: 5, codeudores: [4, 5], fechaInicio: '2026-07-20', diaPago: 20 },
  { cliente: 6, inmueble: 6, codeudores: [5], fechaInicio: '2026-07-21', diaPago: 21 },
  { cliente: 7, inmueble: 7, codeudores: [6], fechaInicio: '2026-07-22', diaPago: 22 },
  { cliente: 8, inmueble: 8, codeudores: [6, 1], fechaInicio: '2026-07-23', diaPago: 23 },
  { cliente: 9, inmueble: 9, codeudores: [3], fechaInicio: '2026-07-24', diaPago: 24 },
];

/**
 * Genera el canon mensual de un contrato desde `fechaInicio` hasta el mes en curso más
 * `horizonte - 1` de anticipación. Réplica mínima de `ObligacionesService.generarCanonesParaContrato`
 * para el seed (el script usa TypeORM directo, sin el contenedor de Nest). Idempotente por el
 * índice único `(contratoId, tipo, periodo)`.
 */
async function generarCanonesDemo(
  manager: Awaited<ReturnType<typeof AppDataSource.initialize>>['manager'],
  contrato: Contrato,
  horizonte: number,
): Promise<number> {
  const repo = manager.getRepository(Obligacion);
  // `contrato.fechaInicio` puede llegar como Date (recién guardado) o como string "YYYY-MM-DD"
  // (releído de la columna `date`): normalizar a fecha local sin pasar por el parseo ISO-UTC.
  const inicio =
    typeof contrato.fechaInicio === 'string'
      ? fechaLocalDesdeString(contrato.fechaInicio)
      : new Date(contrato.fechaInicio.getFullYear(), contrato.fechaInicio.getMonth(), contrato.fechaInicio.getDate());
  const primerPeriodo = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const hoy = new Date();
  const ultimoPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + Math.max(0, horizonte - 1), 1);

  const formato = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
  let generadas = 0;
  for (
    let periodo = new Date(primerPeriodo);
    periodo.getTime() <= ultimoPeriodo.getTime();
    periodo = new Date(periodo.getFullYear(), periodo.getMonth() + 1, 1)
  ) {
    const yaExiste = await repo.findOne({
      where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON, periodo },
    });
    if (yaExiste) continue;

    const ultimoDiaDelMes = new Date(periodo.getFullYear(), periodo.getMonth() + 1, 0).getDate();
    let fechaVencimiento = new Date(
      periodo.getFullYear(),
      periodo.getMonth(),
      Math.min(contrato.diaPago, ultimoDiaDelMes),
    );
    if (fechaVencimiento.getTime() < inicio.getTime()) fechaVencimiento = inicio;

    await repo.save(
      repo.create({
        contrato,
        tipo: TipoObligacion.CANON,
        concepto: `Canon de arrendamiento ${formato.format(periodo)}`,
        periodo,
        fechaVencimiento,
        valorOriginal: contrato.canonValor,
        estado: EstadoObligacion.PENDIENTE,
      }),
    );
    generadas++;
  }
  return generadas;
}

async function siguienteConsecutivoInmueble(ds: Awaited<ReturnType<typeof AppDataSource.initialize>>): Promise<string> {
  return ds.transaction(async (manager) => {
    const repo = manager.getRepository(Consecutivo);
    const consecutivo = await repo
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.tipo = :tipo', { tipo: 'INMUEBLE' })
      .getOneOrFail();
    consecutivo.ultimoNumero = Number(consecutivo.ultimoNumero) + 1;
    await repo.save(consecutivo);
    return `INM-${String(consecutivo.ultimoNumero).padStart(6, '0')}`;
  });
}

export async function seedDemo() {
  const ds = AppDataSource.isInitialized ? AppDataSource : await AppDataSource.initialize();

  // ---- Propietarios adicionales ----
  const propietarioRepo = ds.getRepository(Propietario);
  const propietariosCreados: Propietario[] = [];
  for (const p of PROPIETARIOS_DATA) {
    let propietario = await propietarioRepo.findOne({ where: { numeroDocumento: p.numeroDocumento } });
    if (!propietario) {
      propietario = await propietarioRepo.save(propietarioRepo.create({ ...p, esInmobiliaria: false }));
      console.log(`✅ Propietario creado: ${propietario.nombre}`);
    } else {
      console.log(`ℹ️  Propietario ya existente, se omite: ${propietario.nombre}`);
    }
    propietariosCreados.push(propietario);
  }
  const inmobiliaria = await propietarioRepo.findOneOrFail({ where: { esInmobiliaria: true } });
  const propietariosPorIndice = (i: number) => (i === -1 ? inmobiliaria : propietariosCreados[i]);

  // ---- Clientes ----
  const clienteRepo = ds.getRepository(Cliente);
  const clientes: Cliente[] = [];
  for (const c of CLIENTES_DATA) {
    let cliente = await clienteRepo.findOne({ where: { numeroDocumento: c.numeroDocumento } });
    if (!cliente) {
      cliente = await clienteRepo.save(clienteRepo.create({ ...c, tipoDocumento: 'CC', activo: true }));
      console.log(`✅ Cliente creado: ${cliente.nombreCompleto}`);
    } else {
      console.log(`ℹ️  Cliente ya existente, se omite: ${cliente.nombreCompleto}`);
    }
    clientes.push(cliente);
  }

  // ---- Codeudores ----
  const codeudorRepo = ds.getRepository(Codeudor);
  const codeudores: Codeudor[] = [];
  for (const c of CODEUDORES_DATA) {
    let codeudor = await codeudorRepo.findOne({ where: { numeroDocumento: c.numeroDocumento } });
    if (!codeudor) {
      codeudor = await codeudorRepo.save(codeudorRepo.create({ ...c, tipoDocumento: 'CC', activo: true }));
      console.log(`✅ Codeudor creado: ${codeudor.nombreCompleto}`);
    } else {
      console.log(`ℹ️  Codeudor ya existente, se omite: ${codeudor.nombreCompleto}`);
    }
    codeudores.push(codeudor);
  }

  // ---- Inmuebles ----
  const inmuebleRepo = ds.getRepository(Inmueble);
  const inmuebles: Inmueble[] = [];
  for (const i of INMUEBLES_DATA) {
    let inmueble = await inmuebleRepo.findOne({ where: { direccion: i.direccion } });
    if (!inmueble) {
      const consecutivo = await siguienteConsecutivoInmueble(ds);
      inmueble = await inmuebleRepo.save(
        inmuebleRepo.create({
          propietario: propietariosPorIndice(i.propietario),
          direccion: i.direccion,
          barrio: i.barrio,
          canonValor: i.canonValor,
          depositoValor: i.depositoValor,
          estado: EstadoInmueble.DISPONIBLE,
          consecutivo,
        }),
      );
      console.log(`✅ Inmueble creado: ${inmueble.consecutivo} — ${inmueble.direccion}`);
    } else {
      console.log(`ℹ️  Inmueble ya existente, se omite: ${inmueble.direccion}`);
    }
    inmuebles.push(inmueble);
  }

  // ---- Contratos ----
  const contratoRepo = ds.getRepository(Contrato);
  const horizonte = (await ds.getRepository(Empresa).find({ take: 1 }))[0]?.horizonteMesesCanon ?? 3;
  for (const c of CONTRATOS_DATA) {
    const cliente = clientes[c.cliente];
    const inmueble = inmuebles[c.inmueble];

    const yaExiste = await contratoRepo.findOne({
      where: { cliente: { id: cliente.id }, inmueble: { id: inmueble.id }, estado: EstadoContrato.ACTIVO },
    });
    if (yaExiste) {
      const nuevas = await generarCanonesDemo(ds.manager, yaExiste, horizonte);
      console.log(
        `ℹ️  Contrato ya existente, se omite: ${cliente.nombreCompleto} — ${inmueble.direccion}` +
          (nuevas > 0 ? ` (+${nuevas} canones al día)` : ''),
      );
      continue;
    }

    let contratoCreado!: Contrato;
    await ds.transaction(async (manager) => {
      const codeudoresContrato = c.codeudores.map((idx) => codeudores[idx]);
      const contrato = manager.create(Contrato, {
        cliente,
        inmueble,
        codeudores: codeudoresContrato,
        // Mismo mecanismo de fondo que MORA-01/CONT-04 (ver contrato.entity.ts): `new
        // Date('2025-09-01')` interpreta medianoche UTC y, en zona horaria negativa, el driver
        // de MariaDB persistía el día calendario ANTERIOR en la columna `date`.
        fechaInicio: fechaLocalDesdeString(c.fechaInicio),
        fechaFin: null,
        diaPago: c.diaPago,
        canonValor: inmueble.canonValor,
        depositoGarantia: inmueble.depositoValor ?? 0,
        estado: EstadoContrato.ACTIVO,
      });
      contratoCreado = await manager.save(contrato);

      inmueble.estado = EstadoInmueble.OCUPADO;
      await manager.save(inmueble);

      await generarCanonesDemo(manager, contratoCreado, horizonte);
    });
    console.log(
      `✅ Contrato creado: ${cliente.nombreCompleto} — ${inmueble.direccion} (inicio ${c.fechaInicio}, día de pago ${c.diaPago}, con canon generado)`,
    );
  }

  console.log('🌱 Seed de demostración finalizado correctamente.');
  await ds.destroy();
}

// Auto-ejecución solo si se corre directamente (`npm run seed:demo`); si otro script lo
// importa (ej. `seed-reset.ts`) llama a `seedDemo()` cuando le convenga.
if (require.main === module) {
  seedDemo().catch((err) => {
    console.error('❌ Error ejecutando el seed de demostración:', err);
    process.exit(1);
  });
}

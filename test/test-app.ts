import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Cliente } from '../src/modules/personas/entities/cliente.entity';
import { Codeudor } from '../src/modules/personas/entities/codeudor.entity';
import { Inmueble, EstadoInmueble } from '../src/modules/inmuebles/entities/inmueble.entity';
import { Contrato, EstadoContrato } from '../src/modules/contratos/entities/contrato.entity';
import { Empresa } from '../src/modules/empresa/entities/empresa.entity';
import { HistorialTasaMora } from '../src/modules/empresa/entities/historial-tasa-mora.entity';
import { Obligacion, TipoObligacion, EstadoObligacion } from '../src/modules/obligaciones/entities/obligacion.entity';
import { Propietario } from '../src/modules/propietarios/entities/propietario.entity';

/**
 * Helpers compartidos por la suite de integración (npm test). Levantan la AppModule real
 * contra la base de datos de pruebas (`.env.test`, cargada por `test/jest.setup.ts`), para
 * validar los flujos financieros con transacciones y locks reales de MySQL — no con mocks.
 */
export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
}

export async function bootstrapTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

/** Orden de truncado respetando FKs (se desactivan igual, por si acaso, antes de truncar). */
const TABLAS_EN_ORDEN_DE_LIMPIEZA = [
  'refresh_token',
  'usuario',
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
  'propietario',
  'consecutivo',
  'historial_tasa_mora',
  'empresa',
];

export async function limpiarBaseDeDatos(dataSource: DataSource): Promise<void> {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of TABLAS_EN_ORDEN_DE_LIMPIEZA) {
    await dataSource.query(`TRUNCATE TABLE \`${tabla}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
}

let contador = 0;
function unico(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${Date.now()}-${contador}`;
}

export async function crearCliente(dataSource: DataSource, overrides: Partial<Cliente> = {}): Promise<Cliente> {
  const repo = dataSource.getRepository(Cliente);
  return repo.save(
    repo.create({
      numeroDocumento: unico('CC'),
      nombreCompleto: 'Cliente de prueba',
      ...overrides,
    }),
  );
}

/** Obtiene (o crea, si la suite corre contra una BD recién sincronizada) el propietario "INMOBILIARIA" (§4). */
export async function obtenerOCrearPropietarioInmobiliaria(dataSource: DataSource): Promise<Propietario> {
  const repo = dataSource.getRepository(Propietario);
  const existente = await repo.findOne({ where: { esInmobiliaria: true } });
  if (existente) return existente;
  return repo.save(repo.create({ nombre: 'INMOBILIARIA', esInmobiliaria: true }));
}

export async function crearInmueble(dataSource: DataSource, overrides: Partial<Inmueble> = {}): Promise<Inmueble> {
  const repo = dataSource.getRepository(Inmueble);
  const propietario = overrides.propietario ?? (await obtenerOCrearPropietarioInmobiliaria(dataSource));
  return repo.save(
    repo.create({
      direccion: 'Calle de prueba #1',
      barrio: 'Barrio prueba',
      canonValor: 500000,
      estado: EstadoInmueble.DISPONIBLE,
      ...overrides,
      propietario,
    }),
  );
}

export async function crearCodeudor(dataSource: DataSource, overrides: Partial<Codeudor> = {}): Promise<Codeudor> {
  const repo = dataSource.getRepository(Codeudor);
  return repo.save(
    repo.create({
      numeroDocumento: unico('CD'),
      nombreCompleto: 'Codeudor de prueba',
      ...overrides,
    }),
  );
}

export async function crearContrato(
  dataSource: DataSource,
  cliente: Cliente,
  inmueble: Inmueble,
  overrides: Partial<Contrato> = {},
): Promise<Contrato> {
  const repo = dataSource.getRepository(Contrato);
  return repo.save(
    repo.create({
      cliente,
      inmueble,
      fechaInicio: new Date(),
      diaPago: 5,
      canonValor: inmueble.canonValor,
      estado: EstadoContrato.ACTIVO,
      ...overrides,
    }),
  );
}

/**
 * Inserta/actualiza la fila única de Empresa con parámetros de mora controlados por el test, y
 * sincroniza `historial_tasa_mora` (MORA-02) con una única fila vigente desde el año 2000 —
 * suficientemente atrás para cubrir cualquier `fechaVencimiento` que fabrique `crearObligacion`.
 * Los tests que necesiten probar un cambio de tasa a mitad de la vida de una obligación deben
 * insertar filas adicionales directamente vía `dataSource.getRepository(HistorialTasaMora)`.
 */
export async function configurarEmpresa(
  dataSource: DataSource,
  overrides: Partial<Pick<Empresa, 'diasGraciaMora' | 'porcentajeMoraMensual' | 'saldoInicialCaja'>> = {},
): Promise<Empresa> {
  const repo = dataSource.getRepository(Empresa);
  const empresa = await repo.save(
    repo.create({
      nombre: 'Empresa de pruebas',
      nit: unico('NIT'),
      diasGraciaMora: overrides.diasGraciaMora ?? 5,
      porcentajeMoraMensual: overrides.porcentajeMoraMensual ?? 1.5,
      saldoInicialCaja: overrides.saldoInicialCaja ?? 0,
    }),
  );

  const historialRepo = dataSource.getRepository(HistorialTasaMora);
  await historialRepo.clear();
  await historialRepo.save(
    historialRepo.create({
      diasGraciaMora: empresa.diasGraciaMora,
      porcentajeMoraMensual: empresa.porcentajeMoraMensual,
      vigenteDesde: '2000-01-01' as any,
    }),
  );

  return empresa;
}

/**
 * Crea una obligación con una `fechaVencimiento` desplazada para que, al momento de
 * calcularse la mora (siempre `new Date()` en el service, no inyectable), el atraso resultante
 * sea exactamente `diasAtrasoDeseado` días después del período de gracia. Margen seguro: la
 * prueba completa corre en milisegundos, muy por debajo del umbral de 1 día que podría
 * desplazar el cálculo.
 */
export async function crearObligacion(
  dataSource: DataSource,
  contrato: Contrato,
  params: {
    tipo: TipoObligacion;
    valorOriginal: number;
    diasGraciaEmpresa: number;
    diasAtrasoDeseado: number; // 0 = dentro de gracia (mora=0)
    concepto?: string;
  },
): Promise<Obligacion> {
  const repo = dataSource.getRepository(Obligacion);
  const hoy = new Date();
  const fechaVencimiento = new Date(hoy);
  // El último día de gracia es fechaVencimiento + diasGracia - 1 (MORA-01: la gracia es
  // inclusiva del día de vencimiento, ej. 10-14 ago para gracia=5 y vencimiento=10-ago), así
  // que para obtener exactamente `diasAtrasoDeseado` días de mora hay que retroceder un día
  // adicional respecto del cálculo ingenuo (vencimiento - gracia - atraso).
  fechaVencimiento.setDate(fechaVencimiento.getDate() - params.diasGraciaEmpresa - params.diasAtrasoDeseado + 1);

  return repo.save(
    repo.create({
      contrato,
      tipo: params.tipo,
      concepto: params.concepto ?? `${params.tipo} de prueba`,
      periodo: fechaVencimiento,
      fechaVencimiento,
      valorOriginal: params.valorOriginal,
      estado: EstadoObligacion.PENDIENTE,
    }),
  );
}

export async function recargarObligacion(dataSource: DataSource, id: string): Promise<Obligacion> {
  return dataSource.getRepository(Obligacion).findOneOrFail({ where: { id } });
}

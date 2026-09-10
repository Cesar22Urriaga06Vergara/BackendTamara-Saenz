import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { Empresa } from '../../modules/empresa/entities/empresa.entity';
import { Consecutivo } from '../../modules/empresa/entities/consecutivo.entity';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import { Rol } from '../../common/enums/roles.enum';
import { validarPasswordSegura } from '../../common/utils/password-policy.util';

/**
 * Exige que la contraseña semilla venga por variable de entorno (>= 8 caracteres, una mayúscula y un dígito). Antes había
 * un fallback hardcodeado (`'Admin#2026'`) que además estaba publicado en `.env.example`
 * commiteado (hallazgo S-2): si el despliegue real no la definía, la cuenta de Administrador
 * quedaba con una contraseña que está en el repositorio.
 */
function exigirPasswordSemilla(variable: 'SEED_ADMIN_PASSWORD' | 'SEED_RECEPCION_PASSWORD'): string {
  const valor = process.env[variable];
  if (!valor) {
    throw new Error(`${variable} debe estar definida para sembrar el usuario correspondiente.`);
  }
  return validarPasswordSegura(valor, variable);
}

/**
 * Script de Seed — puebla:
 *  - Empresa (Inversiones Tamara & Saenz S. En C.) con parámetros globales.
 *  - Consecutivos atómicos iniciales (RECIBO_CAJA, EGRESO, NOVEDAD).
 *  - Usuario Administrador y Usuario Recepcionista.
 *
 * Ejecutar DESPUÉS de `npm run migration:run`:
 *   npm run seed
 */
async function seed() {
  const ds = await AppDataSource.initialize();

  // ---- Empresa ----
  const empresaRepo = ds.getRepository(Empresa);
  let empresa = await empresaRepo.findOne({ where: {} });
  if (!empresa) {
    empresa = empresaRepo.create({
      nombre: process.env.EMPRESA_NOMBRE ?? 'Inversiones Tamara & Saenz S. En C.',
      nit: process.env.EMPRESA_NIT ?? '900000000-1',
      slogan: process.env.EMPRESA_SLOGAN ?? 'Resolvemos tu situacion',
      horizonteMesesCanon: Number(process.env.HORIZONTE_MESES_CANON ?? 3),
    });
    await empresaRepo.save(empresa);
    console.log('✅ Empresa creada:', empresa.nombre);
  } else {
    console.log('ℹ️  Empresa ya existente, se omite.');
  }

  // ---- Consecutivos atómicos ----
  const consecutivoRepo = ds.getRepository(Consecutivo);
  const tiposIniciales = [
    { tipo: 'RECIBO_CAJA', prefijo: 'REC-' },
    { tipo: 'EGRESO', prefijo: 'EGR-' },
    { tipo: 'NOVEDAD', prefijo: 'NOV-' },
    { tipo: 'INMUEBLE', prefijo: 'INM-' },
  ];
  for (const t of tiposIniciales) {
    const existe = await consecutivoRepo.findOne({ where: { tipo: t.tipo } });
    if (!existe) {
      await consecutivoRepo.save(consecutivoRepo.create({ ...t, ultimoNumero: 0 }));
      console.log(`✅ Consecutivo creado: ${t.tipo}`);
    }
  }

  // ---- Usuarios iniciales ----
  const usuarioRepo = ds.getRepository(Usuario);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@tamarasaenz.com';
  const adminExiste = await usuarioRepo.findOne({ where: { email: adminEmail } });
  if (!adminExiste) {
    const passwordHash = await bcrypt.hash(exigirPasswordSemilla('SEED_ADMIN_PASSWORD'), 10);
    await usuarioRepo.save(
      usuarioRepo.create({
        nombreCompleto: 'Administrador General',
        email: adminEmail,
        passwordHash,
        rol: Rol.ADMINISTRADOR,
        activo: true,
      }),
    );
    console.log(`✅ Usuario Administrador creado: ${adminEmail}`);
  }

  const recepcionEmail = process.env.SEED_RECEPCION_EMAIL ?? 'recepcion@tamarasaenz.com';
  const recepcionExiste = await usuarioRepo.findOne({ where: { email: recepcionEmail } });
  if (!recepcionExiste) {
    const passwordHash = await bcrypt.hash(exigirPasswordSemilla('SEED_RECEPCION_PASSWORD'), 10);
    await usuarioRepo.save(
      usuarioRepo.create({
        nombreCompleto: 'Recepción Principal',
        email: recepcionEmail,
        passwordHash,
        rol: Rol.RECEPCIONISTA,
        activo: true,
      }),
    );
    console.log(`✅ Usuario Recepcionista creado: ${recepcionEmail}`);
  }

  console.log('🌱 Seed finalizado correctamente.');
  await ds.destroy();
}

seed().catch((err) => {
  console.error('❌ Error ejecutando el seed:', err);
  process.exit(1);
});

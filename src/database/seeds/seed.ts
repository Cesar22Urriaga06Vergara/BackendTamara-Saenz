import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import { Rol } from '../../common/enums/roles.enum';
import { validarPasswordSegura } from '../../common/utils/password-policy.util';

/**
 * Seed mínimo de arranque: solo asegura que exista el primer Administrador del sistema.
 * La empresa, los consecutivos y la gestión de usuarios deben ejecutarse desde la UI de
 * configuración/administración, no desde un script global.
 */
function exigirPasswordSemilla(variable: 'SEED_ADMIN_PASSWORD'): string {
  const valor = process.env[variable];
  if (!valor) {
    throw new Error(`${variable} debe estar definida para crear el usuario administrador inicial.`);
  }
  return validarPasswordSegura(valor, variable);
}

async function seed() {
  const ds = await AppDataSource.initialize();
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
  } else {
    console.log(`ℹ️  Usuario Administrador ya existe: ${adminEmail}`);
  }

  console.log('🌱 Seed mínimo finalizado correctamente.');
  await ds.destroy();
}

seed().catch((err) => {
  console.error('❌ Error ejecutando el seed mínimo:', err);
  process.exit(1);
});

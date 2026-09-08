import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource exclusivo para la CLI de TypeORM (migraciones).
 * La app en runtime usa TypeOrmModule.forRootAsync en app.module.ts.
 * Persistencia gestionada 100% mediante migraciones oficiales:
 *   npm run migration:generate -- src/database/migrations/NombreMigracion
 *   npm run migration:run
 */
export const AppDataSource = new DataSource({
  // Ver nota en app.module.ts: el servidor real es MySQL 8 (Railway). Debe coincidir con app.module.ts.
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Se ejecuta ANTES de que Jest cargue cualquier archivo de test (o AppModule), para que
// process.env ya tenga la base de datos de PRUEBAS cuando ConfigModule.forRoot() la lea.
// `override: true` es intencional aquí: sin él, dotenv nunca sobrescribe variables que ya
// existan en process.env, y en una máquina donde ya corrió `npm run migration:run` (con
// dotenv/config apuntando a .env) podrían quedar valores de la BD real en el entorno.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

// `.env.test.local` (gitignored) sobrescribe lo anterior SOLO en local: sirve para apuntar la
// suite a un MySQL que no está en el `localhost:3306` sin contraseña que asume `.env.test`
// (p. ej. un MySQL 8 en otro puerto). En CI el archivo no existe y no cambia nada.
const rutaLocal = path.resolve(__dirname, '../.env.test.local');
if (fs.existsSync(rutaLocal)) {
  dotenv.config({ path: rutaLocal, override: true });
}

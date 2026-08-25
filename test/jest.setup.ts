import * as dotenv from 'dotenv';
import * as path from 'path';

// Se ejecuta ANTES de que Jest cargue cualquier archivo de test (o AppModule), para que
// process.env ya tenga la base de datos de PRUEBAS cuando ConfigModule.forRoot() la lea.
// `override: true` es intencional aquí: sin él, dotenv nunca sobrescribe variables que ya
// existan en process.env, y en una máquina donde ya corrió `npm run migration:run` (con
// dotenv/config apuntando a .env) podrían quedar valores de la BD real en el entorno.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

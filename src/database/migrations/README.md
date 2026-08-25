# Migraciones

Este proyecto NO usa `synchronize: true` en producción ni scripts SQL manuales.
Todo cambio de esquema se gestiona con migraciones oficiales de TypeORM:

```bash
# 1. Generar migración a partir de los cambios en las entidades
npm run migration:generate -- src/database/migrations/NombreDescriptivo

# 2. Ejecutar migraciones pendientes
npm run migration:run

# 3. (si es necesario) revertir la última migración
npm run migration:revert
```

Ejecuta el seed inicial DESPUÉS de correr las migraciones:

```bash
npm run seed
```

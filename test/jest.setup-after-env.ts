/**
 * Se ejecuta DESPUÉS de instalar el framework de test (por eso `jest.setTimeout` ya existe),
 * una vez por archivo de test.
 *
 * Sube el timeout por defecto de Jest de 5000 ms a 30000 ms para TESTS y HOOKS
 * (`before/afterAll`, `before/afterEach`). Motivo: la suite de integración levanta la
 * `AppModule` real con `synchronize: true` en cada `describe` (re-sincroniza el esquema
 * completo contra MariaDB) y hashea contraseñas con bcrypt cost 10. Bajo carga de CPU
 * —CI, o la máquina local corriendo varias suites en banda— un `bootstrapTestApp()` o un
 * par de `bcrypt.hash` supera los 5000 ms de forma intermitente y hace fallar suites que
 * en aislamiento pasan. 30000 ms da 4-6x de margen sin ocultar un cuelgue real (un
 * deadlock seguiría fallando).
 */
jest.setTimeout(30000);

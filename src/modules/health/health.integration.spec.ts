import * as request from 'supertest';
import { bootstrapTestApp, TestApp } from '../../../test/test-app';

/**
 * El healthcheck es el contrato con Railway y el monitor de uptime: tiene que responder 200
 * SIN token (lo consume un proceso externo que no se autentica) y reflejar el estado real de
 * la base de datos.
 */
describe('HealthController (integración) — /health', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('responde 200 con status ok y la BD "up", sin necesidad de token', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
    expect(res.body.details.database.status).toBe('up');
  });

  it('es público: una petición sin cabecera Authorization no recibe 401', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

import * as request from 'supertest';
import { bootstrapTestApp, TestApp } from '../../test/test-app';

/**
 * Correlation ID por petición (plan 020): `nestjs-pino` añade `x-request-id` a cada respuesta —
 * generado o propagado del entrante — para poder cruzar los logs de Railway con el cliente.
 */
describe('Correlation ID (integración) — x-request-id', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('toda respuesta lleva un x-request-id generado (UUID)', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('si el cliente manda x-request-id, la respuesta lo propaga tal cual', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'trace-de-prueba-123');
    expect(res.headers['x-request-id']).toBe('trace-de-prueba-123');
  });
});

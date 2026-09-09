import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenCron } from './refresh-token.cron';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * S-10: el cron poda `refresh_token` — borra los expirados y los revocados de más de 7 días,
 * y conserva los revocados recientes (ventana para detectar reuso) y los vigentes.
 */
describe('RefreshTokenCron (integración) — poda de refresh_token', () => {
  let testApp: TestApp;
  let cron: RefreshTokenCron;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    cron = testApp.app.get(RefreshTokenCron);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  async function crear(campos: Partial<RefreshToken>): Promise<RefreshToken> {
    const repo = testApp.dataSource.getRepository(RefreshToken);
    return repo.save(
      repo.create({
        usuarioId: 'u-1',
        tokenHash: Math.random().toString(36).slice(2).padEnd(64, '0'),
        expiraEn: dias(1),
        revocado: false,
        ...campos,
      }),
    );
  }

  it('borra los expirados y los revocados viejos; conserva el resto', async () => {
    const vigente = await crear({ expiraEn: dias(1), revocado: false });
    const revocadoReciente = await crear({ expiraEn: dias(1), revocado: true, creadoEn: dias(-2) });
    await crear({ expiraEn: dias(-1), revocado: false }); // expirado
    await crear({ expiraEn: dias(1), revocado: true, creadoEn: dias(-10) }); // revocado viejo

    const borrados = await cron.podar();
    expect(borrados).toBe(2);

    const restantes = await testApp.dataSource.getRepository(RefreshToken).find();
    expect(restantes.map((r) => r.id).sort()).toEqual([vigente.id, revocadoReciente.id].sort());
  });

  it('no borra nada si todo está vigente y sin revocar', async () => {
    await crear({ expiraEn: dias(1) });
    await crear({ expiraEn: dias(5) });
    expect(await cron.podar()).toBe(0);
  });
});

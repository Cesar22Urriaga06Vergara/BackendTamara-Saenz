import { describe, expect, it, jest } from '@jest/globals';
import { QueryRunner } from 'typeorm';
import { RestaurarPropietarioInmobiliaria1786980000000 } from './1786980000000-RestaurarPropietarioInmobiliaria';

describe('RestaurarPropietarioInmobiliaria1786980000000', () => {
  it('inserta INMOBILIARIA solo cuando no existe un propietario especial', async () => {
    const query = jest.fn<(sql: string) => Promise<unknown>>().mockResolvedValue([]);
    const queryRunner = { query } as unknown as QueryRunner;

    await new RestaurarPropietarioInmobiliaria1786980000000().up(queryRunner);

    const sql = query.mock.calls[0][0];
    expect(sql).toContain("SELECT UUID(), 'INMOBILIARIA', 1");
    expect(sql).toContain('WHERE NOT EXISTS');
    expect(sql).toContain('`esInmobiliaria` = 1');
  });
});

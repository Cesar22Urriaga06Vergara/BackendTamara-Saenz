import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterEntrevistaArrendamientoDto } from './filter-entrevista-arrendamiento.dto';

describe('FilterEntrevistaArrendamientoDto', () => {
  it('acepta filtros vacíos enviados por la interfaz', async () => {
    const errores = await validate(
      plainToInstance(FilterEntrevistaArrendamientoDto, { estado: '', fechaDesde: '', fechaHasta: '' }),
    );

    expect(errores).toHaveLength(0);
  });

  it('sigue rechazando un estado o fecha realmente inválidos', async () => {
    const errores = await validate(
      plainToInstance(FilterEntrevistaArrendamientoDto, { estado: 'OTRO', fechaDesde: 'ayer' }),
    );

    expect(errores.map((error) => error.property)).toEqual(expect.arrayContaining(['estado', 'fechaDesde']));
  });
});

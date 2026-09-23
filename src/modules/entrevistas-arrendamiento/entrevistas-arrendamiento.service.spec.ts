import { ForbiddenException } from '@nestjs/common';
import { EntrevistasArrendamientoService } from './entrevistas-arrendamiento.service';
import {
  EstadoCivilEntrevista,
  EstadoEntrevistaArrendamiento,
  TipoDocumentoEntrevista,
} from './entities/entrevista-arrendamiento.entity';

describe('EntrevistasArrendamientoService', () => {
  it('crea una entrevista en borrador conservando el snapshot diligenciado', async () => {
    const saved = {
      id: 'entrevista-1',
      estado: EstadoEntrevistaArrendamiento.BORRADOR,
      nombreCompleto: 'Ana Pérez',
      ingresosMensuales: 2500000,
    };
    const repo = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(saved),
    };
    const consecutivoService = { siguiente: jest.fn().mockResolvedValue({ formateado: 'ENT-000001' }) };
    const service = new EntrevistasArrendamientoService(repo as any, consecutivoService as any);

    const result = await service.crear(
      {
        nombreCompleto: 'Ana Pérez',
        numeroDocumento: '123456789',
        ingresosMensuales: 2500000,
        consecutivo: 'ENT-000001',
      } as any,
      'recepcion@tamarasaenz.com',
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreCompleto: 'Ana Pérez',
        numeroDocumento: '123456789',
        ingresosMensuales: 2500000,
        estado: EstadoEntrevistaArrendamiento.BORRADOR,
        creadoPorEmail: 'recepcion@tamarasaenz.com',
      }),
    );
    expect(result).toEqual(saved);
  });

  it('actualiza una entrevista en borrador', async () => {
    const entrevista = {
      id: 'entrevista-1',
      estado: EstadoEntrevistaArrendamiento.BORRADOR,
      nombreCompleto: 'Ana Pérez',
      numeroDocumento: '123456789',
      telefono: '3000000000',
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(entrevista),
      save: jest.fn().mockImplementation(async (entidad) => entidad),
    };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    const resultado = await service.actualizar('entrevista-1', { telefono: '3000000001' });

    expect(resultado.telefono).toBe('3000000001');
  });

  it('acepta una entrevista en borrador aunque el estado llegue normalizado en minúsculas', async () => {
    const entrevista = {
      id: 'entrevista-2',
      estado: 'borrador',
      nombreCompleto: 'Luis Gómez',
      numeroDocumento: '987654321',
      telefono: '3200000000',
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(entrevista),
      save: jest.fn().mockImplementation(async (entidad) => entidad),
    };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    const resultado = await service.actualizar('entrevista-2', { telefono: '3200000001' });

    expect(resultado.telefono).toBe('3200000001');
  });

  it('ignora campos protegidos en la actualización parcial para no alterar el estado ni la trazabilidad', async () => {
    const entrevista = {
      id: 'entrevista-2',
      estado: EstadoEntrevistaArrendamiento.BORRADOR,
      nombreCompleto: 'Luis Gómez',
      numeroDocumento: '987654321',
      telefono: '3200000000',
      creadoPorEmail: 'recepcion@tamarasaenz.com',
      decididoPorEmail: null,
      motivoDecision: null,
      decididoEn: null,
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(entrevista),
      save: jest.fn().mockImplementation(async (entidad) => entidad),
    };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    const resultado = await service.actualizar('entrevista-2', {
      estado: EstadoEntrevistaArrendamiento.APROBADA,
      nombreCompleto: 'Luis Gómez Actualizado',
      creadoPorEmail: 'admin@tamarasaenz.com',
      motivoDecision: 'No válido',
    } as any);

    expect(resultado.estado).toBe(EstadoEntrevistaArrendamiento.BORRADOR);
    expect(resultado.nombreCompleto).toBe('Luis Gómez Actualizado');
    expect(resultado.creadoPorEmail).toBe('recepcion@tamarasaenz.com');
    expect(resultado.motivoDecision).toBeNull();
  });

  it('rechaza que Recepción apruebe una entrevista', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ estado: EstadoEntrevistaArrendamiento.REALIZADA }),
    };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    await expect(
      service.cambiarEstado(
        'entrevista-1',
        { estado: EstadoEntrevistaArrendamiento.APROBADA },
        'RECEPCIONISTA',
        'recepcion@tamarasaenz.com',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza una entrevista con solicitante menor de edad', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    await expect(
      service.crear(
        {
          nombreCompleto: 'Ana Pérez',
          numeroDocumento: '123456789',
          tipoDocumento: TipoDocumentoEntrevista.CC,
          fechaNacimiento: '2015-01-01',
          estadoCivil: EstadoCivilEntrevista.SOLTERO,
        } as any,
        'recepcion@tamarasaenz.com',
      ),
    ).rejects.toThrow('mayor de edad');
  });

  it('exige los datos completos del fiador cuando se declara que existe', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const service = new EntrevistasArrendamientoService(repo as any, {} as any);

    await expect(
      service.crear(
        {
          nombreCompleto: 'Ana Pérez',
          numeroDocumento: '123456789',
          tieneFiador: true,
        } as any,
        'recepcion@tamarasaenz.com',
      ),
    ).rejects.toThrow('datos completos del fiador');
  });

});

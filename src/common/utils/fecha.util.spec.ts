import { fechaLocalDesdeString, finDelDiaLocal, hoyNegocioISO } from './fecha.util';

describe('fecha.util', () => {
  describe('hoyNegocioISO', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('en la franja nocturna colombiana, Bogotá y UTC caen en días distintos', () => {
      // 2026-01-15 02:00 UTC == 2026-01-14 21:00 en Bogotá (UTC-5).
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T02:00:00Z'));

      expect(hoyNegocioISO('America/Bogota')).toBe('2026-01-14');
      expect(hoyNegocioISO('UTC')).toBe('2026-01-15');
    });

    it('a mediodía en Bogotá, ambas zonas coinciden', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-10T17:00:00Z')); // 12:00 Bogotá

      expect(hoyNegocioISO('America/Bogota')).toBe('2026-06-10');
      expect(hoyNegocioISO('UTC')).toBe('2026-06-10');
    });

    it('devuelve el formato YYYY-MM-DD', () => {
      expect(hoyNegocioISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('fechaLocalDesdeString', () => {
    it('parsea "YYYY-MM-DD" al día calendario local, sin corrimiento por UTC', () => {
      const d = fechaLocalDesdeString('2026-03-01');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(2); // marzo
      expect(d.getDate()).toBe(1);
    });
  });

  describe('finDelDiaLocal', () => {
    it('lleva la fecha al último milisegundo del día', () => {
      const d = finDelDiaLocal('2026-03-01');
      expect(d.getHours()).toBe(23);
      expect(d.getMinutes()).toBe(59);
      expect(d.getSeconds()).toBe(59);
      expect(d.getMilliseconds()).toBe(999);
    });
  });
});

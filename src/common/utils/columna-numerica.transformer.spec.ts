import { columnaNumerica } from './columna-numerica.transformer';

describe('columnaNumerica (transformer decimal ↔ number)', () => {
  describe('from (BD → entidad)', () => {
    it('convierte el string que devuelve mysql2 a number', () => {
      const v = columnaNumerica.from('500000.00');
      expect(v).toBe(500000);
      expect(typeof v).toBe('number');
    });

    it('"0.00" → 0', () => {
      expect(columnaNumerica.from('0.00')).toBe(0);
    });

    it('conserva los decimales', () => {
      expect(columnaNumerica.from('1234.56')).toBe(1234.56);
    });

    it('null → null (columna nullable sin valor)', () => {
      expect(columnaNumerica.from(null)).toBeNull();
    });

    it('undefined → null', () => {
      expect(columnaNumerica.from(undefined)).toBeNull();
    });

    it('es idempotente si el valor ya es number', () => {
      expect(columnaNumerica.from(1234.56)).toBe(1234.56);
    });
  });

  describe('to (entidad → BD)', () => {
    it('pasa el number tal cual', () => {
      expect(columnaNumerica.to(500000)).toBe(500000);
    });

    it('null → null', () => {
      expect(columnaNumerica.to(null)).toBeNull();
    });
  });
});

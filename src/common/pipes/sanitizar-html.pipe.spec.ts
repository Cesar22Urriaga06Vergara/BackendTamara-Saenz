import { ArgumentMetadata } from '@nestjs/common';
import { SanitizarHtmlPipe } from './sanitizar-html.pipe';

const metaBody = { type: 'body' } as ArgumentMetadata;

describe('SanitizarHtmlPipe', () => {
  const pipe = new SanitizarHtmlPipe();

  it('elimina tags reales (protección XSS intacta)', () => {
    const resultado = pipe.transform({ nombre: '<script>alert(1)</script>Hola' }, metaBody);
    expect(resultado.nombre).toBe('Hola');
  });

  it('no corrompe el ampersand de un dato de negocio legítimo (antes quedaba como &amp;)', () => {
    const resultado = pipe.transform({ nombre: 'Inversiones Tamara & Saenz S. En C.' }, metaBody);
    expect(resultado.nombre).toBe('Inversiones Tamara & Saenz S. En C.');
  });

  it('no corrompe < y > cuando son texto plano, no un tag real', () => {
    const resultado = pipe.transform({ texto: '5 < 10 & 20 > 3' }, metaBody);
    expect(resultado.texto).toBe('5 < 10 & 20 > 3');
  });

  it('nunca sanitiza el campo password', () => {
    const resultado = pipe.transform({ password: '<b>Admin#2026&</b>' }, metaBody);
    expect(resultado.password).toBe('<b>Admin#2026&</b>');
  });

  it('sanitiza recursivamente objetos y arreglos anidados (tags no permitidos se desenvuelven, conservan su texto)', () => {
    const resultado = pipe.transform(
      { empresa: { nombre: 'A & B', datos: { extra: '<i>x</i>y' } }, lista: ['<b>1</b>', 'C & D'] },
      metaBody,
    );
    expect(resultado.empresa.nombre).toBe('A & B');
    expect(resultado.empresa.datos.extra).toBe('xy');
    expect(resultado.lista).toEqual(['1', 'C & D']);
  });

  it('no toca el valor si el metadata no es de tipo body', () => {
    const valor = { nombre: '<script>x</script>' };
    const resultado = pipe.transform(valor, { type: 'query' });
    expect(resultado).toBe(valor);
  });
});

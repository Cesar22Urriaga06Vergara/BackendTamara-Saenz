/**
 * Guardia de arranque contra un `JWT_ACCESS_SECRET` inseguro (hallazgo S-1).
 *
 * `JWT_ACCESS_SECRET` es el ÚNICO material que firma los access tokens
 * (`auth.module.ts`, `auth.service.ts`, `jwt.strategy.ts`). Quien lo adivine puede forjar un
 * JWT válido de rol ADMINISTRADOR y operar todo el motor financiero. Esta función se llama en
 * `main.ts` antes de `app.listen()`: si el secreto es corto o es un placeholder de ejemplo, el
 * proceso aborta en el arranque en vez de servir tokens falsificables.
 *
 * NO valida entropía real (un `AAAA...` de 40 chars pasaría) — para eso está la rotación
 * operativa a un valor aleatorio. Esto es un piso, no un techo.
 */

const LONGITUD_MINIMA = 32;

/** Subcadenas que delatan un valor de ejemplo/placeholder copiado sin rotar. */
const MARCADORES_INSEGUROS = ['change_this', 'changeme', 'reemplazar', 'placeholder', 'example', 'test_secret'];

export function validarSecretoJwt(secreto: string | undefined): void {
  if (!secreto || secreto.length < LONGITUD_MINIMA) {
    throw new Error(
      `JWT_ACCESS_SECRET inseguro: debe tener al menos ${LONGITUD_MINIMA} caracteres. ` +
        "Genera uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  const enMinuscula = secreto.toLowerCase();
  if (MARCADORES_INSEGUROS.some((marcador) => enMinuscula.includes(marcador))) {
    throw new Error(
      'JWT_ACCESS_SECRET inseguro: parece un valor de ejemplo (contiene un marcador tipo ' +
        '"change_this"/"REEMPLAZAR"/"example"). Genera uno real con: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
}

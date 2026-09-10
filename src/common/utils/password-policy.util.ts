export const PATRON_PASSWORD_SEGURA = /^(?=.*[A-Z])(?=.*\d)/;

export function validarPasswordSegura(password: string, variable: string): string {
  if (password.length < 8 || !PATRON_PASSWORD_SEGURA.test(password)) {
    throw new Error(`${variable} debe tener al menos 8 caracteres, una mayúscula y un dígito.`);
  }
  return password;
}

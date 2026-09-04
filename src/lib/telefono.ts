/**
 * El teléfono se pide como "351 555 1234": diez números, sin el 0 ni el 15.
 *
 * Lo usan la página y el servidor, así que lo que se ve mientras se escribe y
 * lo que se valida al guardar son exactamente la misma regla.
 */

/** Deja solo los diez números, tolerando que peguen el +54 o el 0 de adelante. */
export function digitosTelefono(valor: string): string {
  let digitos = valor.replace(/\D/g, "");

  // Solo sacamos los prefijos cuando sobran números: si no, romperíamos el
  // teléfono de alguien mientras lo está escribiendo.
  if (digitos.length > 10 && digitos.startsWith("54")) digitos = digitos.slice(2);
  if (digitos.length > 10 && digitos.startsWith("0")) digitos = digitos.slice(1);

  return digitos.slice(0, 10);
}

/** "3515551234" a "351 555 1234". */
export function formatearTelefono(valor: string): string {
  const digitos = digitosTelefono(valor);
  return [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 10)]
    .filter(Boolean)
    .join(" ");
}

export function telefonoValido(valor: string): boolean {
  return digitosTelefono(valor).length === 10;
}

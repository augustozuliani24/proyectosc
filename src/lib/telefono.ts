/**
 * El teléfono se pide como "351 555 1234": diez números, sin el 0 ni el 15.
 *
 * Lo usan la página y el servidor, así que lo que se ve mientras se escribe y
 * lo que se valida al guardar son exactamente la misma regla.
 */

/** Los números del teléfono sin prefijos, pero sin recortar lo que sobre. */
function numerosSinPrefijo(valor: string): string {
  let digitos = valor.replace(/\D/g, "");

  // Solo sacamos los prefijos cuando sobran números: si no, romperíamos el
  // teléfono de alguien mientras lo está escribiendo.
  if (digitos.length > 10 && digitos.startsWith("54")) digitos = digitos.slice(2);
  if (digitos.length > 10 && digitos.startsWith("0")) digitos = digitos.slice(1);

  return digitos;
}

/** Deja como mucho diez números, para ir mostrándolos mientras se escribe. */
export function digitosTelefono(valor: string): string {
  return numerosSinPrefijo(valor).slice(0, 10);
}

/** "3515551234" a "351 555 1234". */
export function formatearTelefono(valor: string): string {
  const digitos = digitosTelefono(valor);
  return [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 10)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Valida sobre los números sin recortar: si recortáramos, un teléfono con un
 * dígito de más pasaría como válido y se guardaría un número equivocado.
 */
export function telefonoValido(valor: string): boolean {
  return numerosSinPrefijo(valor).length === 10;
}

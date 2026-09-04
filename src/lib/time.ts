/**
 * Utilidades de fecha/hora con zona horaria explícita.
 *
 * El servidor corre en UTC (Vercel), pero todas las reservas se piensan en la
 * hora local del santuario. Estas funciones hacen la conversión sin depender de
 * librerías externas, usando Intl para resolver el offset real de cada fecha
 * (así sigue siendo correcto aunque la zona tenga horario de verano).
 */

/** Offset de la zona horaria, en minutos, para un instante dado. */
function offsetMinutos(instante: Date, timeZone: string): number {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes: Record<string, string> = {};
  for (const parte of formato.formatToParts(instante)) {
    partes[parte.type] = parte.value;
  }

  const comoUTC = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second),
  );

  const sinMilis = instante.getTime() - (instante.getTime() % 1000);
  return (comoUTC - sinMilis) / 60000;
}

/** Convierte una fecha local ("2026-09-10") + minutos del día a un instante UTC. */
export function aInstanteUTC(fecha: string, minutosDelDia: number, timeZone: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const horas = Math.floor(minutosDelDia / 60);
  const minutos = minutosDelDia % 60;
  const ingenuo = Date.UTC(anio, mes - 1, dia, horas, minutos, 0, 0);

  // Primera aproximación con el offset del instante ingenuo, y un refinamiento
  // para los saltos de horario de verano.
  let offset = offsetMinutos(new Date(ingenuo), timeZone);
  let resultado = ingenuo - offset * 60000;
  offset = offsetMinutos(new Date(resultado), timeZone);
  resultado = ingenuo - offset * 60000;

  return new Date(resultado);
}

/** Fecha local ("2026-09-10") de un instante en la zona indicada. */
export function aFechaLocal(instante: Date, timeZone: string): string {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formato.format(instante);
}

/** Minutos desde la medianoche local de un instante en la zona indicada. */
export function aMinutosDelDia(instante: Date, timeZone: string): number {
  const formato = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [horas, minutos] = formato.format(instante).split(":").map(Number);
  return horas * 60 + minutos;
}

/** Día de la semana (0 = domingo) de una fecha local. */
export function diaDeLaSemana(fecha: string, timeZone: string): number {
  const instante = aInstanteUTC(fecha, 12 * 60, timeZone);
  const nombre = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instante);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nombre);
}

/** "8:30" a partir de 510 minutos. */
export function formatearHora(minutosDelDia: number): string {
  const horas = Math.floor(minutosDelDia / 60);
  const minutos = minutosDelDia % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

/** Convierte "08:30" a 510 minutos. Devuelve null si el formato no sirve. */
export function parsearHora(hora: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/** Valida el formato "YYYY-MM-DD" y que la fecha exista de verdad. */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const prueba = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    prueba.getUTCFullYear() === anio &&
    prueba.getUTCMonth() === mes - 1 &&
    prueba.getUTCDate() === dia
  );
}

/** Diferencia en días entre dos fechas locales ("2026-09-10"). */
export function diferenciaEnDias(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round(
    (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000,
  );
}

/** Suma (o resta) días a una fecha local "2026-09-10". */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return [
    resultado.getUTCFullYear(),
    String(resultado.getUTCMonth() + 1).padStart(2, "0"),
    String(resultado.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** "miércoles 10 de septiembre de 2026" */
export function fechaEnPalabras(fecha: string, timeZone: string): string {
  const instante = aInstanteUTC(fecha, 12 * 60, timeZone);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instante);
}

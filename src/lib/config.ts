/**
 * Configuración del santuario. Todo se puede ajustar por variables de entorno
 * sin tocar código (ver .env.example).
 */

export interface Lugar {
  id: string;
  nombre: string;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Lee "id:Nombre,id:Nombre" y arma la lista de lugares reservables. */
function lugares(value: string | undefined, fallback: Lugar[]): Lugar[] {
  if (!value) return fallback;

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [id, nombre] = item.split(":").map((parte) => parte.trim());
      return { id, nombre: nombre || id };
    })
    .filter((lugar) => /^[a-z0-9_-]+$/.test(lugar.id));

  return parsed.length > 0 ? parsed : fallback;
}

export const TIMEZONE = process.env.SANTUARIO_TIMEZONE ?? "America/Argentina/Buenos_Aires";

/** Nombre del lugar en general, para títulos y textos. */
export const SANTUARIO_NOMBRE = process.env.SANTUARIO_NOMBRE ?? "Santuario de Schoenstatt";

/**
 * Los espacios que se pueden reservar. Cada uno tiene su propia disponibilidad:
 * dos personas pueden reservar el mismo horario en lugares distintos.
 */
export const LUGARES: Lugar[] = lugares(process.env.SANTUARIO_LUGARES, [
  { id: "santuario", nombre: "Santuario" },
  { id: "sum", nombre: "SUM" },
  { id: "cocina", nombre: "Cocina" },
]);

export const IDS_LUGARES = LUGARES.map((lugar) => lugar.id);

export function nombreDeLugar(id: string): string {
  return LUGARES.find((lugar) => lugar.id === id)?.nombre ?? id;
}

/** Horario general en el que se puede reservar, en minutos desde la medianoche. */
export const APERTURA_MIN = num(process.env.SANTUARIO_APERTURA_HORA, 8) * 60;
export const CIERRE_MIN = num(process.env.SANTUARIO_CIERRE_HORA, 22) * 60;

export interface Horario {
  aperturaMin: number;
  cierreMin: number;
}

function minutosDeHora(texto: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas < 0 || horas > 24 || minutos < 0 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/**
 * Días con un horario distinto al general, como "0:13:30-22:00" para que los
 * domingos recién se pueda reservar desde las 13:30. El día va de 0 (domingo)
 * a 6 (sábado) y se pueden encadenar varios separados por comas.
 */
function horariosEspeciales(value: string | undefined, fallback: string): Record<number, Horario> {
  const horarios: Record<number, Horario> = {};

  for (const item of (value ?? fallback).split(",")) {
    const texto = item.trim();
    const corte = texto.indexOf(":");
    if (corte < 0) continue;

    const numeroDia = Number(texto.slice(0, corte));
    const rango = texto.slice(corte + 1);
    if (!Number.isInteger(numeroDia) || numeroDia < 0 || numeroDia > 6) continue;

    const [desde, hasta] = rango.split("-");
    const aperturaMin = minutosDeHora(desde ?? "");
    const cierreMin = minutosDeHora(hasta ?? "");
    if (aperturaMin === null || cierreMin === null || cierreMin <= aperturaMin) continue;

    horarios[numeroDia] = { aperturaMin, cierreMin };
  }

  return horarios;
}

export const HORARIOS_ESPECIALES = horariosEspeciales(
  process.env.SANTUARIO_HORARIOS_POR_DIA,
  "0:13:30-22:00",
);

/** El horario que rige un día de la semana (0 = domingo). */
export function horarioDelDia(diaSemana: number): Horario {
  return HORARIOS_ESPECIALES[diaSemana] ?? { aperturaMin: APERTURA_MIN, cierreMin: CIERRE_MIN };
}

export const NOMBRES_DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Cada cuántos minutos cae un horario en la grilla (inicio y fin). */
export const PASO_MIN = num(process.env.SANTUARIO_PASO_MINUTOS, 30);

/** Tope de personas que se pueden anotar en una reserva. */
export const MAX_PERSONAS = num(process.env.SANTUARIO_MAX_PERSONAS, 300);

/** Con cuántos días de anticipación como máximo se puede reservar. */
export const MAX_DIAS_ANTICIPACION = num(process.env.SANTUARIO_MAX_DIAS, 90);

/** Anticipación mínima para reservar el mismo día, en minutos. */
export const ANTICIPACION_MIN = num(process.env.SANTUARIO_ANTICIPACION_MINUTOS, 60);

/**
 * Días de la semana en los que no se reserva (0 = domingo ... 6 = sábado).
 * Por defecto está abierto todos los días.
 */
export const DIAS_CERRADOS: number[] = (process.env.SANTUARIO_DIAS_CERRADOS ?? "")
  .split(",")
  // Sin el filtro de vacíos, una variable sin definir dejaba un "" que
  // Number() convierte en 0, y el domingo quedaba cerrado sin que nadie lo
  // hubiera pedido.
  .map((item) => item.trim())
  .filter(Boolean)
  .map(Number)
  .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);

/** Calendario de Google donde viven las reservas. */
export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";

/** Contacto que se muestra si algo falla. */
export const CONTACTO_WHATSAPP = process.env.SANTUARIO_CONTACTO ?? "";
